import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../../modules/auth/token.service';
import type { JwtTokenPayload } from '@repo/api-contracts';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Authentication credentials missing or invalid');
    }

    try {
      const payload = this.tokenService.verifyToken<JwtTokenPayload>(token);

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Attach normalized user payload to request
      (request as unknown as { user: unknown }).user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || ['CUSTOMER'],
        sellerId: payload.sellerId ?? null,
        sessionId: payload.sessionId,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException((err as Error).message || 'Invalid authentication token');
    }
  }

  private extractTokenFromRequest(request: Request): string | null {
    // 1. Authorization header: Bearer <token>
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // 2. HttpOnly Cookie: accessToken
    if (request.cookies && typeof request.cookies['accessToken'] === 'string') {
      return request.cookies['accessToken'];
    }

    return null;
  }
}
