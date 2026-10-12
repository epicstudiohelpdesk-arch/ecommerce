import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { SellerEligibility } from '@repo/api-contracts';

@Injectable()
export class SellerEligibilityService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Evaluates whether a seller is approved, active, and legally authorized to conduct commerce.
   */
  async checkSellerEligibility(sellerId: string): Promise<SellerEligibility> {
    const [seller] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.sellerProfiles.id,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
        isPayoutEnabled: this.databaseService.schema.sellerProfiles.isPayoutEnabled,
        userStatus: this.databaseService.schema.users.status,
      })
      .from(this.databaseService.schema.sellerProfiles)
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.sellerProfiles.userId, this.databaseService.schema.users.id),
      )
      .where(eq(this.databaseService.schema.sellerProfiles.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    if (seller.userStatus === 'SUSPENDED' || seller.userStatus === 'DEACTIVATED') {
      return {
        sellerId,
        isEligibleToSell: false,
        canPublishProducts: false,
        canReceivePayouts: false,
        verificationStatus: seller.verificationStatus,
        reason: 'User account is suspended or deactivated by platform administration',
      };
    }

    if (seller.verificationStatus === 'SUSPENDED') {
      return {
        sellerId,
        isEligibleToSell: false,
        canPublishProducts: false,
        canReceivePayouts: false,
        verificationStatus: 'SUSPENDED',
        reason: 'Artisan shop has been suspended under compliance sanction',
      };
    }

    if (seller.verificationStatus !== 'VERIFIED') {
      return {
        sellerId,
        isEligibleToSell: false,
        canPublishProducts: false,
        canReceivePayouts: false,
        verificationStatus: seller.verificationStatus,
        reason: `Artisan verification is in ${seller.verificationStatus} state; requires VERIFIED status`,
      };
    }

    return {
      sellerId,
      isEligibleToSell: true,
      canPublishProducts: true,
      canReceivePayouts: seller.isPayoutEnabled,
      verificationStatus: 'VERIFIED',
    };
  }
}
