import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
  refreshTokenSchema,
} from '@repo/validation';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() rawBody: unknown, @Req() req: Request) {
    const parseResult = registerSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Registration validation failed',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.register(
      parseResult.data,
      req.ip,
      req.headers['user-agent'],
    );

    return createSuccessResponse(result);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() rawBody: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parseResult = loginSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Login credentials validation failed',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.login(
      parseResult.data,
      req.ip,
      req.headers['user-agent'],
    );

    // If login is full success (no MFA challenge pending), set secure HttpOnly cookies
    if (!result.requiresMfa) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }

    return createSuccessResponse(result);
  }

  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  async mfaChallenge(
    @Body() rawBody: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parseResult = mfaChallengeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'MFA challenge verification failed',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.mfaChallenge(
      parseResult.data,
      req.ip,
      req.headers['user-agent'],
    );

    if (!result.requiresMfa) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }

    return createSuccessResponse(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() rawBody: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parseResult = refreshTokenSchema.safeParse(rawBody || {});
    const candidateToken =
      parseResult.success && parseResult.data.refreshToken
        ? parseResult.data.refreshToken
        : req.cookies?.['refreshToken'];

    if (!candidateToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refresh(
      candidateToken,
      req.ip,
      req.headers['user-agent'],
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return createSuccessResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Query('all') all: string,
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const revokeAll = all === 'true' || all === '1';
    await this.authService.logout(user?.sessionId, user?.id, revokeAll);

    this.clearAuthCookies(res);

    return createSuccessResponse({
      message: revokeAll ? 'All sessions revoked' : 'Logged out successfully',
    });
  }

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    const user = await this.authService.getMe(userId);
    return createSuccessResponse(user);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() rawBody: unknown, @Req() req: Request) {
    const parseResult = verifyEmailSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid verification token format',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.verifyEmail(parseResult.data.token, req.ip);
    return createSuccessResponse(result);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() rawBody: unknown, @Req() req: Request) {
    const parseResult = forgotPasswordSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid email format',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.forgotPassword(parseResult.data.email, req.ip);
    return createSuccessResponse(result);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() rawBody: unknown, @Req() req: Request) {
    const parseResult = resetPasswordSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Password reset validation failed',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.resetPassword(
      parseResult.data.token,
      parseResult.data.newPassword,
      req.ip,
    );

    return createSuccessResponse(result);
  }

  @Post('mfa/setup')
  async setupMfa(@CurrentUser('id') userId: string) {
    const result = await this.authService.setupMfa(userId);
    return createSuccessResponse(result);
  }

  @Post('mfa/verify')
  async verifyMfa(
    @Body() rawBody: unknown,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const parseResult = mfaVerifySchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid MFA verification format',
        details: parseResult.error.format(),
      });
    }

    const result = await this.authService.verifyAndEnableMfa(
      userId,
      parseResult.data.secret,
      parseResult.data.code,
      req.ip,
    );

    return createSuccessResponse(result);
  }

  @Post('mfa/disable')
  async disableMfa(
    @Body('code') code: string,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('MFA verification code is required to disable MFA');
    }

    const result = await this.authService.disableMfa(userId, code, req.ip);
    return createSuccessResponse(result);
  }

  @Get('sessions')
  async getSessions(@CurrentUser('id') userId: string) {
    const sessions = await this.sessionService.getUserActiveSessions(userId);
    return createSuccessResponse({ items: sessions, total: sessions.length });
  }

  @Post('sessions/revoke-all')
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.sessionService.revokeAllUserSessions(userId);
    this.clearAuthCookies(res);
    return createSuccessResponse({ message: 'All active sessions revoked' });
  }

  // --- Helper Cookie Management Methods ---
  private setAuthCookies(res: Response, accessToken: string, refreshToken?: string) {
    const isProd = process.env['NODE_ENV'] === 'production';

    // Access Token Cookie (15 min)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    // Refresh Token Cookie (7 days)
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
  }

  private clearAuthCookies(res: Response) {
    const isProd = process.env['NODE_ENV'] === 'production';
    res.clearCookie('accessToken', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });
    res.clearCookie('refreshToken', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });
  }
}
