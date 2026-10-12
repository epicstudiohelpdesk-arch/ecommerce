import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ResourceOwnerGuard } from '../src/common/guards/resource-owner.guard';
import { CsrfProtectionMiddleware } from '../src/common/middleware/csrf.middleware';
import type { AuditService } from '../src/modules/audit/audit.service';

describe('Authorization Guards & Security Middleware', () => {
  describe('RolesGuard', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    function createMockContext(roles: string[], requiredRoles?: string[]): ExecutionContext {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { roles },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows request when no roles are required on route', () => {
      const ctx = createMockContext(['CUSTOMER'], undefined);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows request when user possesses the required role', () => {
      const ctx = createMockContext(['FINANCE_CONTROLLER'], ['FINANCE_CONTROLLER']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Super Administrator to access any role-protected route', () => {
      const ctx = createMockContext(['SUPER_ADMIN'], ['FINANCE_CONTROLLER']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects access with ForbiddenException when user lacks required role', () => {
      const ctx = createMockContext(['CUSTOMER'], ['FINANCE_CONTROLLER']);
      expect(() => guard.canActivate(ctx)).toThrowError(ForbiddenException);
    });
  });

  describe('ResourceOwnerGuard (ABAC Tenancy)', () => {
    const mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };
    const guard = new ResourceOwnerGuard(mockAuditService as unknown as AuditService);

    function createResourceContext(
      user: { id: string; sellerId?: string | null; roles?: string[] },
      params: Record<string, string> = {},
      body: Record<string, unknown> = {},
    ): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            params,
            body,
            ip: '127.0.0.1',
            headers: { 'user-agent': 'vitest-agent' },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows seller access to their own seller resources', async () => {
      const sellerId = '11111111-1111-1111-1111-111111111111';
      const ctx = createResourceContext(
        { id: 'user-1', sellerId, roles: ['APPROVED_SELLER'] },
        { sellerId },
      );

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('blocks and logs security alert when seller attempts to access foreign seller resource', async () => {
      const ownSellerId = '11111111-1111-1111-1111-111111111111';
      const foreignSellerId = '22222222-2222-2222-2222-222222222222';

      const ctx = createResourceContext(
        { id: 'user-1', sellerId: ownSellerId, roles: ['APPROVED_SELLER'] },
        { sellerId: foreignSellerId },
      );

      await expect(guard.canActivate(ctx)).rejects.toThrowError(ForbiddenException);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SECURITY_CROSS_TENANT_VIOLATION_ATTEMPT',
          resourceType: 'SELLER',
          resourceId: foreignSellerId,
        }),
      );
    });

    it('allows Super Administrator to inspect foreign seller resource', async () => {
      const foreignSellerId = '22222222-2222-2222-2222-222222222222';
      const ctx = createResourceContext(
        { id: 'admin-1', roles: ['SUPER_ADMIN'] },
        { sellerId: foreignSellerId },
      );

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('allows customer access to own user profile data', async () => {
      const userId = '33333333-3333-3333-3333-333333333333';
      const ctx = createResourceContext({ id: userId, roles: ['CUSTOMER'] }, { userId });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('blocks customer access to foreign customer user profile', async () => {
      const ownUserId = '33333333-3333-3333-3333-333333333333';
      const foreignUserId = '44444444-4444-4444-4444-444444444444';
      const ctx = createResourceContext(
        { id: ownUserId, roles: ['CUSTOMER'] },
        { userId: foreignUserId },
      );

      await expect(guard.canActivate(ctx)).rejects.toThrowError(ForbiddenException);
    });
  });

  describe('CsrfProtectionMiddleware', () => {
    const middleware = new CsrfProtectionMiddleware();

    it('allows read-only GET requests through without CSRF checks', () => {
      const next = vi.fn();
      const req = { method: 'GET', headers: {}, cookies: { accessToken: 'token' } };
      middleware.use(req as unknown as Request, {} as unknown as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows mutation requests with Bearer token authentication', () => {
      const next = vi.fn();
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer token-123' },
        cookies: {},
      };
      middleware.use(req as unknown as Request, {} as unknown as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('blocks state-changing cookie mutation without custom header or approved origin', () => {
      const next = vi.fn();
      const req = {
        method: 'POST',
        headers: {},
        cookies: { accessToken: 'cookie-token' },
      };
      expect(() =>
        middleware.use(req as unknown as Request, {} as unknown as Response, next),
      ).toThrowError(ForbiddenException);
      expect(next).not.toHaveBeenCalled();
    });

    it('permits state-changing cookie mutation when x-requested-with header is present', () => {
      const next = vi.fn();
      const req = {
        method: 'POST',
        headers: { 'x-requested-with': 'XMLHttpRequest' },
        cookies: { accessToken: 'cookie-token' },
      };
      middleware.use(req as unknown as Request, {} as unknown as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
