import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params, query, body } = request;

    if (!user) {
      throw new ForbiddenException('Forbidden: Unauthenticated identity');
    }

    // Super Administrators can inspect any platform resource
    if (user.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    // 1. Check Seller Isolation Invariant
    const targetSellerId = params?.sellerId || query?.sellerId || body?.sellerId;
    if (targetSellerId) {
      if (!user.sellerId || user.sellerId !== targetSellerId) {
        // High-priority security violation logging
        await this.auditService.logEvent({
          actorId: user.id,
          actorRole: user.roles?.[0] || 'UNKNOWN',
          action: 'SECURITY_CROSS_TENANT_VIOLATION_ATTEMPT',
          resourceType: 'SELLER',
          resourceId: targetSellerId,
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
          metadata: {
            actorSellerId: user.sellerId,
            attemptedSellerId: targetSellerId,
          },
        });

        throw new ForbiddenException(
          'Forbidden: You do not have permission to access resources belonging to this seller',
        );
      }
    }

    // 2. Check Customer Data Isolation Invariant
    const targetUserId = params?.userId || params?.customerId || query?.customerId;
    if (targetUserId) {
      // Support staff / managers may view within their operational scope
      const isStaffViewer =
        user.roles?.includes('CUSTOMER_SUPPORT') ||
        user.roles?.includes('MARKETPLACE_MANAGER') ||
        user.roles?.includes('TRUST_SAFETY');

      if (!isStaffViewer && user.id !== targetUserId) {
        await this.auditService.logEvent({
          actorId: user.id,
          actorRole: user.roles?.[0] || 'CUSTOMER',
          action: 'SECURITY_CROSS_CUSTOMER_VIOLATION_ATTEMPT',
          resourceType: 'USER',
          resourceId: targetUserId,
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
        });

        throw new ForbiddenException(
          'Forbidden: You do not have permission to access this customer record',
        );
      }
    }

    return true;
  }
}
