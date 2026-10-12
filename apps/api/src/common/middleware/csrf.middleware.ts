import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

    // Only inspect state-changing requests
    if (!isMutation) {
      return next();
    }

    // If using Bearer token authentication in Authorization header, immune to standard browser CSRF
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    // If using cookies for authentication, enforce CSRF defense
    const hasAuthCookie =
      req.cookies && (req.cookies['accessToken'] || req.cookies['refreshToken']);
    if (hasAuthCookie) {
      const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
      const origin = req.headers['origin'] || req.headers['referer'];
      const allowedOrigins = (process.env['ALLOWED_ORIGINS'] || 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim());

      const isValidOrigin = origin
        ? allowedOrigins.some((allowed) => (origin as string).startsWith(allowed))
        : false;

      if (!customHeader && !isValidOrigin) {
        throw new ForbiddenException(
          'CSRF protection: State-changing requests authenticated via cookies require custom headers or approved origin',
        );
      }
    }

    next();
  }
}
