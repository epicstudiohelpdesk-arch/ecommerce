import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../modules/database/database.service';

@Injectable()
export class SellerActiveGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Forbidden: Unauthenticated caller');
    }

    if (user.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    // Must have seller role
    const hasSellerRole =
      user.roles?.includes('APPROVED_SELLER') || user.roles?.includes('SELLER_OWNER');

    if (!hasSellerRole || !user.sellerId) {
      throw new ForbiddenException('Forbidden: Active seller profile required for this operation');
    }

    // Verify seller profile status directly in database
    const [seller] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.sellerProfiles.id,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
        isPayoutEnabled: this.databaseService.schema.sellerProfiles.isPayoutEnabled,
      })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, user.sellerId))
      .limit(1);

    if (!seller) {
      throw new ForbiddenException('Forbidden: Seller profile not found');
    }

    if (seller.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        `Forbidden: Seller status is ${seller.verificationStatus}. Must be VERIFIED.`,
      );
    }

    return true;
  }
}
