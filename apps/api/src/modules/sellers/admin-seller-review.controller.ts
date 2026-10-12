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
import { SellerReviewService } from './seller-review.service';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  listSellerApplicationsQuerySchema,
  adminReviewSellerSchema,
  adminSuspendSellerSchema,
} from '@repo/validation';

@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY', 'MARKETPLACE_MANAGER')
export class AdminSellerReviewController {
  constructor(private readonly reviewService: SellerReviewService) {}

  @Get()
  async listApplications(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = listSellerApplicationsQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      status: rawQuery['status'],
      businessType: rawQuery['businessType'],
      search: rawQuery['search'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.reviewService.listApplications(parseResult.data);
    return createSuccessResponse({
      items,
      ...meta,
    });
  }

  @Get(':sellerId')
  async getApplicationDetail(
    @Param('sellerId') sellerId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    const detail = await this.reviewService.getApplicationDetail(sellerId, user.id);
    return createSuccessResponse(detail);
  }

  @Post(':sellerId/review')
  @HttpCode(HttpStatus.OK)
  async reviewApplication(
    @Param('sellerId') sellerId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = adminReviewSellerSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Review decision validation failed',
        details: parseResult.error.format(),
      });
    }

    const reviewerRole = user.roles?.[0] || 'SUPER_ADMIN';
    const result = await this.reviewService.reviewApplication(
      sellerId,
      user.id,
      reviewerRole,
      parseResult.data,
    );

    return createSuccessResponse(result);
  }

  @Post(':sellerId/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendSeller(
    @Param('sellerId') sellerId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = adminSuspendSellerSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Suspension parameters validation failed',
        details: parseResult.error.format(),
      });
    }

    const reviewerRole = user.roles?.[0] || 'SUPER_ADMIN';
    const result = await this.reviewService.suspendSeller(
      sellerId,
      user.id,
      reviewerRole,
      parseResult.data,
    );

    return createSuccessResponse(result);
  }

  @Post(':sellerId/reinstate')
  @HttpCode(HttpStatus.OK)
  async reinstateSeller(
    @Param('sellerId') sellerId: string,
    @CurrentUser() user: AuthenticatedUserPayload,
  ) {
    const reviewerRole = user.roles?.[0] || 'SUPER_ADMIN';
    const result = await this.reviewService.reinstateSeller(sellerId, user.id, reviewerRole);
    return createSuccessResponse(result);
  }
}
