import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ProductModerationService } from './product-moderation.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { paginationQuerySchema, adminModerateProductSchema } from '@repo/validation';

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY', 'MARKETPLACE_MANAGER')
export class AdminProductModerationController {
  constructor(private readonly moderationService: ProductModerationService) {}

  @Get('moderation')
  async listPending(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = paginationQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid pagination query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.moderationService.listPending(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Get('products/:productId')
  async getProductForModeration(@Param('productId') productId: string) {
    const detail = await this.moderationService.getProductForModeration(productId);
    return createSuccessResponse(detail);
  }

  @Post('products/:productId/moderate')
  @HttpCode(HttpStatus.OK)
  async moderateProduct(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('productId') productId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = adminModerateProductSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid moderation input',
        details: parseResult.error.format(),
      });
    }

    const reviewerRole = user.roles?.[0] || 'SUPER_ADMIN';
    const result = await this.moderationService.moderateProduct(
      productId,
      user.id,
      reviewerRole,
      parseResult.data,
    );

    return createSuccessResponse(result);
  }
}
