import { Controller, Get, Query, UseGuards, NotFoundException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { DatabaseService } from '../database/database.service';
import { LedgerService } from './ledger.service';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller()
export class LedgerController {
  constructor(
    @Inject(LedgerService)
    private readonly ledgerService: LedgerService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Retrieves financial balance statement for the authenticated artisan seller.
   */
  @Get('seller/finance/balance')
  @UseGuards(JwtAuthGuard)
  async getSellerBalance(@CurrentUser() user: AuthenticatedUserPayload) {
    const [sellerProfile] = await this.databaseService.db
      .select({ id: this.databaseService.schema.sellerProfiles.id })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, user.id))
      .limit(1);

    if (!sellerProfile) {
      throw new NotFoundException('Artisan seller profile not found for authenticated user');
    }

    const statement = await this.ledgerService.getSellerBalance(sellerProfile.id);
    return createSuccessResponse(statement);
  }

  /**
   * Retrieves chronological ledger entries for the authenticated artisan seller.
   */
  @Get('seller/finance/ledger')
  @UseGuards(JwtAuthGuard)
  async getSellerLedger(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const [sellerProfile] = await this.databaseService.db
      .select({ id: this.databaseService.schema.sellerProfiles.id })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, user.id))
      .limit(1);

    if (!sellerProfile) {
      throw new NotFoundException('Artisan seller profile not found for authenticated user');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    const entries = await this.ledgerService.getSellerLedgerEntries(
      sellerProfile.id,
      parsedLimit,
      parsedOffset,
    );
    return createSuccessResponse(entries);
  }
}
