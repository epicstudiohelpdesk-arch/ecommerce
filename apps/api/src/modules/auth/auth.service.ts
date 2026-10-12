import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { AuditService } from './../audit/audit.service';
import type { RegisterInput, LoginInput, MfaChallengeInput } from '@repo/validation';
import type { AuthUser, LoginResult, RegisterResult } from '@repo/api-contracts';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly mfaService: MfaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registers a new customer identity with password hashing and verification setup.
   */
  async register(
    input: RegisterInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RegisterResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Check for duplicate email
    const [existing] = await this.databaseService.db
      .select({ id: this.databaseService.schema.users.id })
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await this.passwordService.hash(input.password);

    // 3. Parse full name
    const parts = input.fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'User';
    const lastName = parts.slice(1).join(' ') || ' ';

    // 4. Create user
    const [user] = await this.databaseService.db
      .insert(this.databaseService.schema.users)
      .values({
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone: input.phone ?? null,
        status: 'ACTIVE',
        isEmailVerified: false,
        mfaEnabled: false,
      })
      .returning();

    if (!user) {
      throw new InternalServerErrorException('Failed to create user account');
    }

    // 5. Assign default role: CUSTOMER
    let [customerRole] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.roles)
      .where(eq(this.databaseService.schema.roles.name, 'CUSTOMER'))
      .limit(1);

    if (!customerRole) {
      const [newRole] = await this.databaseService.db
        .insert(this.databaseService.schema.roles)
        .values({
          name: 'CUSTOMER',
          description: 'Registered marketplace customer',
        })
        .returning();

      if (!newRole) {
        throw new InternalServerErrorException('Failed to resolve customer role');
      }
      customerRole = newRole;
    }

    await this.databaseService.db
      .insert(this.databaseService.schema.userRoles)
      .values({
        userId: user.id,
        roleId: customerRole.id,
      })
      .onConflictDoNothing();

    // 6. Generate single-use email verification token
    const verificationToken = this.tokenService.signEmailVerificationToken(user.id, user.email);

    // 7. Record immutable audit event
    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: 'CUSTOMER',
      action: 'AUTH_REGISTER',
      resourceType: 'USER',
      resourceId: user.id,
      ipAddress,
      userAgent,
      metadata: { email: user.email },
    });

    const isNonProd = process.env['NODE_ENV'] !== 'production';

    return {
      userId: user.id,
      email: user.email,
      requiresEmailVerification: true,
      verificationToken: isNonProd ? verificationToken : undefined,
    };
  }

  /**
   * Authenticates user credentials, enforces status constraints, and initiates MFA if configured.
   */
  async login(input: LoginInput, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Fetch user
    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      // Timing attack mitigation: run dummy verify
      await this.passwordService.verify(
        '$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHQ$dummyhash12345678901234567890',
        input.password,
      );
      await this.auditService.logEvent({
        actorRole: 'ANONYMOUS',
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: normalizedEmail,
        ipAddress,
        userAgent,
        metadata: { reason: 'ACCOUNT_NOT_FOUND' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Verify password
    const isPasswordValid = await this.passwordService.verify(user.passwordHash, input.password);
    if (!isPasswordValid) {
      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: 'INVALID_CREDENTIALS' },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Enforce account status restrictions
    if (user.status === 'SUSPENDED') {
      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'AUTH_LOGIN_BLOCKED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: 'SUSPENDED_ACCOUNT' },
      });
      throw new ForbiddenException(
        'Your account has been suspended. Please contact customer support.',
      );
    }

    if (user.status === 'DEACTIVATED') {
      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'AUTH_LOGIN_BLOCKED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
        userAgent,
        metadata: { reason: 'DEACTIVATED_ACCOUNT' },
      });
      throw new ForbiddenException('Your account has been deactivated.');
    }

    // 4. Fetch assigned roles and seller scope
    const { roles, sellerId } = await this.getUserRolesAndScope(user.id);

    // 5. Privileged / Staff role MFA policy:
    // If user has MFA enabled, issue temporary MFA challenge ticket
    if (user.mfaEnabled) {
      const mfaTicket = this.tokenService.signMfaTicket(user.id, user.email);
      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: roles[0] || 'CUSTOMER',
        action: 'AUTH_LOGIN_MFA_CHALLENGE',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      return {
        requiresMfa: true,
        mfaTicket,
        message: 'Multi-factor authentication code required',
      };
    }

    // 6. Create session & mint tokens
    const refreshToken = this.tokenService.generateRefreshToken();
    const session = await this.sessionService.createSession(
      user.id,
      refreshToken,
      ipAddress,
      userAgent,
      7,
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      sellerId,
      sessionId: session.id,
    });

    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: roles[0] || 'CUSTOMER',
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'SESSION',
      resourceId: session.id,
      ipAddress,
      userAgent,
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      mfaEnabled: user.mfaEnabled,
      roles,
      sellerId,
    };

    return {
      requiresMfa: false,
      user: authUser,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Completes login for accounts with MFA enabled using a temporary challenge ticket.
   */
  async mfaChallenge(
    input: MfaChallengeInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const payload = this.tokenService.verifyToken<{ sub: string; email: string; type: string }>(
      input.mfaTicket,
    );

    if (payload.type !== 'mfa_ticket') {
      throw new UnauthorizedException('Invalid MFA ticket type');
    }

    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, payload.sub))
      .limit(1);

    if (!user || !user.mfaSecret || !user.mfaEnabled) {
      throw new UnauthorizedException('MFA is not configured for this user');
    }

    const isValid = this.mfaService.verifyCode(input.code, user.mfaSecret);
    if (!isValid) {
      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'AUTH_MFA_CHALLENGE_FAILED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    const { roles, sellerId } = await this.getUserRolesAndScope(user.id);
    const refreshToken = this.tokenService.generateRefreshToken();
    const session = await this.sessionService.createSession(
      user.id,
      refreshToken,
      ipAddress,
      userAgent,
      7,
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      sellerId,
      sessionId: session.id,
    });

    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: roles[0] || 'CUSTOMER',
      action: 'AUTH_LOGIN_MFA_SUCCESS',
      resourceType: 'SESSION',
      resourceId: session.id,
      ipAddress,
      userAgent,
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      mfaEnabled: user.mfaEnabled,
      roles,
      sellerId,
    };

    return {
      requiresMfa: false,
      user: authUser,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refreshes access token and rotates the refresh token.
   */
  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const session = await this.sessionService.findValidSession(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, session.userId))
      .limit(1);

    if (!user || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UnauthorizedException('User account is suspended or inactive');
    }

    const { roles, sellerId } = await this.getUserRolesAndScope(user.id);

    // Rotate refresh token
    const newRefreshToken = this.tokenService.generateRefreshToken();
    await this.sessionService.rotateSession(session.id, newRefreshToken, 7);

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      sellerId,
      sessionId: session.id,
    });

    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: roles[0] || 'CUSTOMER',
      action: 'AUTH_TOKEN_REFRESH',
      resourceType: 'SESSION',
      resourceId: session.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Invalidates active user session(s).
   */
  async logout(sessionId?: string, userId?: string, revokeAll = false) {
    if (revokeAll && userId) {
      await this.sessionService.revokeAllUserSessions(userId);
      await this.auditService.logEvent({
        actorId: userId,
        actorRole: 'CUSTOMER',
        action: 'AUTH_LOGOUT_ALL_SESSIONS',
        resourceType: 'USER',
        resourceId: userId,
      });
    } else if (sessionId) {
      await this.sessionService.revokeSession(sessionId);
      await this.auditService.logEvent({
        actorId: userId ?? null,
        actorRole: 'CUSTOMER',
        action: 'AUTH_LOGOUT',
        resourceType: 'SESSION',
        resourceId: sessionId,
      });
    }
  }

  /**
   * Verifies email using a single-use signed token.
   */
  async verifyEmail(token: string, ipAddress?: string) {
    const payload = this.tokenService.verifyToken<{ sub: string; email: string; type: string }>(
      token,
    );

    if (payload.type !== 'verify_email') {
      throw new BadRequestException('Invalid token type');
    }

    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      return { success: true, message: 'Email address is already verified' };
    }

    await this.databaseService.db
      .update(this.databaseService.schema.users)
      .set({
        isEmailVerified: true,
        status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
        updatedAt: new Date(),
      })
      .where(eq(this.databaseService.schema.users.id, user.id));

    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: 'CUSTOMER',
      action: 'AUTH_EMAIL_VERIFIED',
      resourceType: 'USER',
      resourceId: user.id,
      ipAddress,
    });

    return { success: true, message: 'Email verified successfully' };
  }

  /**
   * Initiates password reset with generic non-enumerating response.
   */
  async forgotPassword(email: string, ipAddress?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.email, normalizedEmail))
      .limit(1);

    let resetToken: string | undefined;

    if (user && user.status !== 'DEACTIVATED') {
      resetToken = this.tokenService.signPasswordResetToken(user.id, user.email, user.passwordHash);

      await this.auditService.logEvent({
        actorId: user.id,
        actorRole: 'CUSTOMER',
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress,
      });
    }

    const isNonProd = process.env['NODE_ENV'] !== 'production';

    return {
      success: true,
      message:
        'If an account exists with this email address, password reset instructions have been sent.',
      ...(isNonProd && resetToken ? { resetToken } : {}),
    };
  }

  /**
   * Executes password reset, verifies non-replayability, and revokes all active sessions.
   */
  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const payload = this.tokenService.verifyToken<{
      sub: string;
      email: string;
      pwdFingerprint: string;
      type: string;
    }>(token);

    if (payload.type !== 'password_reset') {
      throw new BadRequestException('Invalid password reset token');
    }

    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, payload.sub))
      .limit(1);

    if (!user || user.status === 'DEACTIVATED') {
      throw new BadRequestException('User account cannot be reset');
    }

    // Verify replay protection: fingerprint must match user's current password hash
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(user.passwordHash)
      .digest('hex')
      .substring(0, 16);

    if (payload.pwdFingerprint !== currentFingerprint) {
      throw new BadRequestException(
        'Password reset token has already been used or credentials have changed',
      );
    }

    // Hash new password
    const newPasswordHash = await this.passwordService.hash(newPassword);

    // Update password
    await this.databaseService.db
      .update(this.databaseService.schema.users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(this.databaseService.schema.users.id, user.id));

    // CRITICAL SECURITY CONTROL: Revoke all existing sessions upon password reset
    await this.sessionService.revokeAllUserSessions(user.id);

    await this.auditService.logEvent({
      actorId: user.id,
      actorRole: 'CUSTOMER',
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resourceType: 'USER',
      resourceId: user.id,
      ipAddress,
    });

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  /**
   * Generates TOTP secret and QR URL for MFA setup.
   */
  async setupMfa(userId: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    const secret = this.mfaService.generateSecret();
    const otpauthUrl = this.mfaService.generateUri(user.email, secret);

    return {
      secret,
      otpauthUrl,
    };
  }

  /**
   * Verifies TOTP code and activates MFA on the account.
   */
  async verifyAndEnableMfa(userId: string, secret: string, code: string, ipAddress?: string) {
    const isValid = this.mfaService.verifyCode(code, secret);
    if (!isValid) {
      throw new BadRequestException('Invalid MFA verification code');
    }

    const recoveryCodes = this.mfaService.generateRecoveryCodes();

    await this.databaseService.db
      .update(this.databaseService.schema.users)
      .set({
        mfaEnabled: true,
        mfaSecret: secret,
        updatedAt: new Date(),
      })
      .where(eq(this.databaseService.schema.users.id, userId));

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'AUTH_MFA_ENABLED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
    });

    return {
      success: true,
      message: 'Two-factor authentication successfully enabled',
      recoveryCodes,
    };
  }

  /**
   * Disables MFA on an account after code verification.
   */
  async disableMfa(userId: string, code: string, ipAddress?: string) {
    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, userId))
      .limit(1);

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled on this account');
    }

    const isValid = this.mfaService.verifyCode(code, user.mfaSecret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    await this.databaseService.db
      .update(this.databaseService.schema.users)
      .set({
        mfaEnabled: false,
        mfaSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(this.databaseService.schema.users.id, userId));

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'AUTH_MFA_DISABLED',
      resourceType: 'USER',
      resourceId: userId,
      ipAddress,
    });

    return {
      success: true,
      message: 'Two-factor authentication disabled',
    };
  }

  /**
   * Retrieves profile details for the authenticated user.
   */
  async getMe(userId: string): Promise<AuthUser> {
    const [user] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    const { roles, sellerId } = await this.getUserRolesAndScope(user.id);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      mfaEnabled: user.mfaEnabled,
      roles,
      sellerId,
    };
  }

  /**
   * Helper to retrieve all roles and seller isolation scope for a user.
   */
  private async getUserRolesAndScope(userId: string) {
    const userRoleRows = await this.databaseService.db
      .select({
        roleName: this.databaseService.schema.roles.name,
        sellerId: this.databaseService.schema.userRoles.sellerId,
      })
      .from(this.databaseService.schema.userRoles)
      .innerJoin(
        this.databaseService.schema.roles,
        eq(this.databaseService.schema.userRoles.roleId, this.databaseService.schema.roles.id),
      )
      .where(eq(this.databaseService.schema.userRoles.userId, userId));

    const roles = userRoleRows.map((r) => r.roleName);
    const sellerRow = userRoleRows.find((r) => r.sellerId !== null);
    const sellerId = sellerRow ? sellerRow.sellerId : null;

    return {
      roles: roles.length > 0 ? roles : ['CUSTOMER'],
      sellerId,
    };
  }
}
