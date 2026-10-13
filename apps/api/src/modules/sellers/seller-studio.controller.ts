import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SellerStudioService } from './seller-studio.service';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  sellerDashboardQuerySchema,
  sellerAnalyticsQuerySchema,
  updateShopProfileSchema,
} from '@repo/validation';

@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('APPROVED_SELLER', 'SELLER_OWNER', 'SELLER_APPLICANT', 'SUPER_ADMIN')
export class SellerStudioController {
  constructor(
    @Inject(SellerStudioService)
    private readonly studioService: SellerStudioService,
  ) {}

  @Get('dashboard/overview')
  async getDashboardOverview(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query('period') period?: string,
  ) {
    const parseResult = sellerDashboardQuerySchema.safeParse({ period: period || '7d' });
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid dashboard period parameter',
        details: parseResult.error.format(),
      });
    }

    const overview = await this.studioService.getDashboardOverview(user.id, parseResult.data);
    return createSuccessResponse(overview);
  }

  @Get('analytics/performance')
  async getPerformanceAnalytics(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query('period') period?: string,
  ) {
    const parseResult = sellerAnalyticsQuerySchema.safeParse({ period: period || '30d' });
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid analytics period parameter',
        details: parseResult.error.format(),
      });
    }

    const analytics = await this.studioService.getPerformanceAnalytics(user.id, parseResult.data);
    return createSuccessResponse(analytics);
  }

  @Patch('shop')
  async updateShopProfile(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = updateShopProfileSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid shop profile update parameters',
        details: parseResult.error.format(),
      });
    }

    const updated = await this.studioService.updateShopProfile(user.id, parseResult.data);
    return createSuccessResponse(updated);
  }

  @Get('notifications')
  async getNotifications(@CurrentUser() user: AuthenticatedUserPayload) {
    const notifications = await this.studioService.getNotifications(user.id);
    return createSuccessResponse(notifications);
  }
}
