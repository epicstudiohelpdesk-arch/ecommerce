import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { DatabaseService } from '../database/database.service';
import { InventoryService } from './inventory.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { stockAdjustmentSchema } from '@repo/validation';

@Controller('seller/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('APPROVED_SELLER', 'SUPER_ADMIN')
export class SellerInventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Helper to verify ownership of a variant by the authenticated seller.
   */
  private async verifyVariantOwnership(userId: string, userRole: string, variantId: string) {
    if (userRole === 'SUPER_ADMIN') {
      return;
    }

    const [variant] = await this.databaseService.db
      .select({
        variantId: this.databaseService.schema.productVariants.id,
        productId: this.databaseService.schema.productVariants.productId,
        sellerId: this.databaseService.schema.products.sellerId,
        sellerUserId: this.databaseService.schema.sellerProfiles.userId,
      })
      .from(this.databaseService.schema.productVariants)
      .innerJoin(
        this.databaseService.schema.products,
        eq(
          this.databaseService.schema.productVariants.productId,
          this.databaseService.schema.products.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.sellerProfiles,
        eq(
          this.databaseService.schema.products.sellerId,
          this.databaseService.schema.sellerProfiles.id,
        ),
      )
      .where(eq(this.databaseService.schema.productVariants.id, variantId))
      .limit(1);

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    if (variant.sellerUserId !== userId) {
      throw new ForbiddenException('Forbidden: You do not own the product for this variant');
    }
  }

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  async adjustStock(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = stockAdjustmentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid stock adjustment parameters',
        details: parseResult.error.format(),
      });
    }

    const userRole = user.roles?.[0] || 'APPROVED_SELLER';
    await this.verifyVariantOwnership(user.id, userRole, parseResult.data.variantId);

    const result = await this.inventoryService.adjustStock(
      parseResult.data.variantId,
      parseResult.data,
      user.id,
      userRole,
    );

    return createSuccessResponse(result);
  }

  @Get(':variantId')
  async getVariantStock(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('variantId') variantId: string,
  ) {
    const userRole = user.roles?.[0] || 'APPROVED_SELLER';
    await this.verifyVariantOwnership(user.id, userRole, variantId);

    const stock = await this.inventoryService.getVariantStock(variantId);
    return createSuccessResponse(stock);
  }
}
