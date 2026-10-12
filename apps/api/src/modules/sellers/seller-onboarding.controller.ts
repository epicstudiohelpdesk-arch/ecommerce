import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SellerOnboardingService } from './seller-onboarding.service';
import { SellerEligibilityService } from './seller-eligibility.service';
import { DatabaseService } from '../database/database.service';
import { eq } from 'drizzle-orm';
import { createSuccessResponse } from '@repo/api-contracts';
import {
  saveDraftSellerSchema,
  sellerApplicationSubmitSchema,
  presignedDocumentRequestSchema,
  shopSlugSchema,
} from '@repo/validation';

@Controller('seller')
@UseGuards(JwtAuthGuard)
export class SellerOnboardingController {
  constructor(
    private readonly onboardingService: SellerOnboardingService,
    private readonly eligibilityService: SellerEligibilityService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('onboarding/status')
  async getStatus(@CurrentUser() user: AuthenticatedUserPayload) {
    const status = await this.onboardingService.getOnboardingStatus(user.id);
    return createSuccessResponse(status);
  }

  @Post('onboarding/draft')
  @HttpCode(HttpStatus.OK)
  async saveDraft(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = saveDraftSellerSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Draft validation failed',
        details: parseResult.error.format(),
      });
    }

    const updated = await this.onboardingService.saveDraft(user.id, parseResult.data);
    return createSuccessResponse(updated);
  }

  @Get('onboarding/check-slug')
  async checkSlug(@CurrentUser() user: AuthenticatedUserPayload, @Query('slug') slug?: string) {
    if (!slug) {
      throw new BadRequestException('Shop slug query parameter is required');
    }

    const parseResult = shopSlugSchema.safeParse(slug);
    if (!parseResult.success) {
      return createSuccessResponse({
        available: false,
        message: 'Invalid slug format. Use lowercase alphanumeric characters and single hyphens.',
      });
    }

    const status = await this.onboardingService.getOnboardingStatus(user.id);
    const result = await this.onboardingService.checkSlugAvailability(
      parseResult.data,
      status.sellerId,
    );
    return createSuccessResponse(result);
  }

  @Post('onboarding/documents')
  @HttpCode(HttpStatus.CREATED)
  async requestDocumentUpload(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = presignedDocumentRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Document upload request validation failed',
        details: parseResult.error.format(),
      });
    }

    const ticket = await this.onboardingService.requestDocumentUpload(user.id, parseResult.data);
    return createSuccessResponse(ticket);
  }

  @Post('onboarding/documents/:documentId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmDocumentUpload(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('documentId') documentId: string,
  ) {
    const result = await this.onboardingService.confirmDocumentUpload(user.id, documentId);
    return createSuccessResponse(result);
  }

  @Delete('onboarding/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('documentId') documentId: string,
  ) {
    const result = await this.onboardingService.deleteDraftDocument(user.id, documentId);
    return createSuccessResponse(result);
  }

  @Post('onboarding/apply')
  @HttpCode(HttpStatus.OK)
  async submitApplication(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = sellerApplicationSubmitSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Application submission validation failed',
        details: parseResult.error.format(),
      });
    }

    const result = await this.onboardingService.submitApplication(user.id, parseResult.data);
    return createSuccessResponse(result);
  }

  @Get('shop')
  async getShop(@CurrentUser() user: AuthenticatedUserPayload) {
    const shop = await this.onboardingService.getSellerShop(user.id);
    return createSuccessResponse(shop);
  }

  @Get('eligibility')
  async getEligibility(@CurrentUser() user: AuthenticatedUserPayload) {
    const [seller] = await this.databaseService.db
      .select({ id: this.databaseService.schema.sellerProfiles.id })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, user.id))
      .limit(1);

    if (!seller) {
      return createSuccessResponse({
        sellerId: '',
        isEligibleToSell: false,
        canPublishProducts: false,
        canReceivePayouts: false,
        verificationStatus: 'DRAFT',
        reason: 'No seller profile found for current user account',
      });
    }

    const eligibility = await this.eligibilityService.checkSellerEligibility(seller.id);
    return createSuccessResponse(eligibility);
  }
}
