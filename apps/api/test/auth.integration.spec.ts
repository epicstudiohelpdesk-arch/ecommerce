import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as otplib from 'otplib';
import { DatabaseService } from '../src/modules/database/database.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { TokenService } from '../src/modules/auth/token.service';
import { SessionService } from '../src/modules/auth/session.service';
import { MfaService } from '../src/modules/auth/mfa.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Authentication & Session Integration Tests (PostgreSQL Test DB)', () => {
  let dbService: DatabaseService;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let sessionService: SessionService;
  let mfaService: MfaService;
  let auditService: AuditService;
  let authService: AuthService;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    passwordService = new PasswordService();
    tokenService = new TokenService(new JwtService());
    sessionService = new SessionService(dbService, tokenService);
    mfaService = new MfaService();
    auditService = new AuditService(dbService);
    authService = new AuthService(
      dbService,
      passwordService,
      tokenService,
      sessionService,
      mfaService,
      auditService,
    );
  });

  afterAll(async () => {
    await dbService.onModuleDestroy();
  });

  const testEmail = `test.artisan.${Date.now()}@example.test`;
  const testPassword = 'StrongArtisanP@ssword2026!';
  let userId: string;
  let verificationToken: string | undefined;

  it('registers a new customer successfully with Argon2id hash and CUSTOMER role', async () => {
    const regResult = await authService.register({
      email: testEmail,
      password: testPassword,
      fullName: 'Aarav Patel',
      phone: '+919876543211',
    });

    expect(regResult.userId).toBeDefined();
    expect(regResult.email).toBe(testEmail);
    expect(regResult.requiresEmailVerification).toBe(true);
    expect(regResult.verificationToken).toBeDefined();

    userId = regResult.userId;
    verificationToken = regResult.verificationToken;

    // Verify stored user in DB
    const [storedUser] = await dbService.db
      .select()
      .from(dbService.schema.users)
      .where(eq(dbService.schema.users.id, userId));

    expect(storedUser).toBeDefined();
    expect(storedUser.email).toBe(testEmail);
    expect(storedUser.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(storedUser.isEmailVerified).toBe(false);

    // Verify assigned role is CUSTOMER
    const roles = await dbService.db
      .select({ roleName: dbService.schema.roles.name })
      .from(dbService.schema.userRoles)
      .innerJoin(
        dbService.schema.roles,
        eq(dbService.schema.userRoles.roleId, dbService.schema.roles.id),
      )
      .where(eq(dbService.schema.userRoles.userId, userId));

    expect(roles.some((r) => r.roleName === 'CUSTOMER')).toBe(true);
  });

  it('rejects duplicate email registration with ConflictException (409)', async () => {
    await expect(
      authService.register({
        email: testEmail,
        password: 'AnotherPassword123!',
        fullName: 'Duplicate User',
      }),
    ).rejects.toThrowError('An account with this email address already exists');
  });

  it('verifies email with single-use token', async () => {
    expect(verificationToken).toBeDefined();
    const result = await authService.verifyEmail(verificationToken!);
    expect(result.success).toBe(true);

    const [updatedUser] = await dbService.db
      .select()
      .from(dbService.schema.users)
      .where(eq(dbService.schema.users.id, userId));

    expect(updatedUser.isEmailVerified).toBe(true);
  });

  it('authenticates user login and creates server session with rotating refresh token', async () => {
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });

    expect(loginResult.requiresMfa).toBe(false);
    if (!loginResult.requiresMfa) {
      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.user.id).toBe(userId);
      expect(loginResult.user.email).toBe(testEmail);

      // Verify active session exists in DB
      const session = await sessionService.findValidSession(loginResult.refreshToken);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(userId);
      expect(session?.revokedAt).toBeNull();
    }
  });

  it('rejects login with incorrect password', async () => {
    await expect(
      authService.login({
        email: testEmail,
        password: 'IncorrectPassword123!',
      }),
    ).rejects.toThrowError('Invalid email or password');
  });

  it('rejects login for non-existent email with generic error', async () => {
    await expect(
      authService.login({
        email: 'non.existent@example.test',
        password: 'AnyPassword123!',
      }),
    ).rejects.toThrowError('Invalid email or password');
  });

  it('rotates refresh token and invalidates old token', async () => {
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });

    expect(loginResult.requiresMfa).toBe(false);
    if (!loginResult.requiresMfa) {
      const oldRefreshToken = loginResult.refreshToken;

      // First refresh: succeeds
      const refreshResult = await authService.refresh(oldRefreshToken);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.refreshToken).not.toBe(oldRefreshToken);

      // Replay of old refresh token: MUST fail
      await expect(authService.refresh(oldRefreshToken)).rejects.toThrowError(
        'Invalid or expired session',
      );

      // Refresh with new token: succeeds
      const secondRefresh = await authService.refresh(refreshResult.refreshToken);
      expect(secondRefresh.accessToken).toBeDefined();
    }
  });

  it('revokes session on logout', async () => {
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });

    expect(loginResult.requiresMfa).toBe(false);
    if (!loginResult.requiresMfa) {
      const session = await sessionService.findValidSession(loginResult.refreshToken);
      expect(session).toBeDefined();

      await authService.logout(session!.id, userId, false);

      // Valid session lookup should now return null
      const revoked = await sessionService.findValidSession(loginResult.refreshToken);
      expect(revoked).toBeNull();

      // Refresh attempt must fail
      await expect(authService.refresh(loginResult.refreshToken)).rejects.toThrowError(
        'Invalid or expired session',
      );
    }
  });

  it('executes password reset and revokes all active user sessions', async () => {
    // 1. Create an active session
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });
    expect(loginResult.requiresMfa).toBe(false);

    // 2. Request password reset
    const forgotResult = await authService.forgotPassword(testEmail);
    expect(forgotResult.success).toBe(true);
    expect(forgotResult.resetToken).toBeDefined();

    const newPassword = 'BrandNewP@ssword2026!';

    // 3. Reset password
    const resetResult = await authService.resetPassword(forgotResult.resetToken!, newPassword);
    expect(resetResult.success).toBe(true);

    // 4. Verify previous session was revoked
    if (!loginResult.requiresMfa) {
      await expect(authService.refresh(loginResult.refreshToken)).rejects.toThrowError(
        'Invalid or expired session',
      );
    }

    // 5. Verify token replay fails
    await expect(
      authService.resetPassword(forgotResult.resetToken!, 'AnotherNewP@ssword2026!'),
    ).rejects.toThrowError(
      'Password reset token has already been used or credentials have changed',
    );

    // 6. Old password fails; new password succeeds
    await expect(
      authService.login({ email: testEmail, password: testPassword }),
    ).rejects.toThrowError('Invalid email or password');

    const newLogin = await authService.login({ email: testEmail, password: newPassword });
    expect(newLogin.requiresMfa).toBe(false);
  });

  it('enforces MFA lifecycle: setup, code verification, challenge login, and disable', async () => {
    // 1. Setup MFA
    const setup = await authService.setupMfa(userId);
    expect(setup.secret).toBeDefined();
    expect(setup.otpauthUrl).toBeDefined();

    // 2. Verify with valid TOTP code
    const validCode = otplib.generateSync({ secret: setup.secret });
    const verifyResult = await authService.verifyAndEnableMfa(userId, setup.secret, validCode);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.recoveryCodes).toHaveLength(8);

    // 3. Login now returns MFA challenge ticket instead of tokens
    const mfaLogin = await authService.login({
      email: testEmail,
      password: 'BrandNewP@ssword2026!',
    });
    expect(mfaLogin.requiresMfa).toBe(true);
    if (mfaLogin.requiresMfa) {
      expect(mfaLogin.mfaTicket).toBeDefined();

      // 4. Invalid code rejected
      await expect(
        authService.mfaChallenge({ mfaTicket: mfaLogin.mfaTicket, code: '000000' }),
      ).rejects.toThrowError('Invalid MFA verification code');

      // 5. Valid code completes login
      const currentCode = otplib.generateSync({ secret: setup.secret });
      const challengeResult = await authService.mfaChallenge({
        mfaTicket: mfaLogin.mfaTicket,
        code: currentCode,
      });

      expect(challengeResult.requiresMfa).toBe(false);
      if (!challengeResult.requiresMfa) {
        expect(challengeResult.accessToken).toBeDefined();
        expect(challengeResult.user.id).toBe(userId);
      }
    }

    // 6. Disable MFA
    const disableCode = otplib.generateSync({ secret: setup.secret });
    const disableResult = await authService.disableMfa(userId, disableCode);
    expect(disableResult.success).toBe(true);
  });

  it('prevents suspended accounts from logging in', async () => {
    // Suspend user
    await dbService.db
      .update(dbService.schema.users)
      .set({ status: 'SUSPENDED' })
      .where(eq(dbService.schema.users.id, userId));

    await expect(
      authService.login({ email: testEmail, password: 'BrandNewP@ssword2026!' }),
    ).rejects.toThrowError('Your account has been suspended');

    // Reactivate for test clean state
    await dbService.db
      .update(dbService.schema.users)
      .set({ status: 'ACTIVE' })
      .where(eq(dbService.schema.users.id, userId));
  });

  it('verifies that audit logs recorded security events without exposing raw secrets', async () => {
    const logs = await dbService.db
      .select()
      .from(dbService.schema.auditLogs)
      .where(eq(dbService.schema.auditLogs.actorId, userId));

    expect(logs.length).toBeGreaterThan(0);

    for (const log of logs) {
      // Ensure no raw passwords or secrets are logged in metadata
      if (log.metadata) {
        const metadataStr = JSON.stringify(log.metadata).toLowerCase();
        expect(metadataStr.includes('brandnewp@ssword2026!')).toBe(false);
        expect(metadataStr.includes('strongartisanp@ssword2026!')).toBe(false);
      }
    }
  });
});
