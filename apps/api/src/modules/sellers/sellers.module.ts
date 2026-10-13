import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SellerDocumentsStorageService } from './seller-documents-storage.service';
import { SellerEligibilityService } from './seller-eligibility.service';
import { SellerOnboardingService } from './seller-onboarding.service';
import { SellerReviewService } from './seller-review.service';
import { SellerOnboardingController } from './seller-onboarding.controller';
import { AdminSellerReviewController } from './admin-seller-review.controller';
import { SellerOrdersController } from './seller-orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { SellerStudioController } from './seller-studio.controller';
import { SellerStudioService } from './seller-studio.service';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [
    SellerOnboardingController,
    AdminSellerReviewController,
    SellerOrdersController,
    SellerStudioController,
  ],
  providers: [
    SellerDocumentsStorageService,
    SellerEligibilityService,
    SellerOnboardingService,
    SellerReviewService,
    SellerOrdersService,
    SellerStudioService,
  ],
  exports: [
    SellerEligibilityService,
    SellerOnboardingService,
    SellerReviewService,
    SellerDocumentsStorageService,
    SellerOrdersService,
    SellerStudioService,
  ],
})
export class SellersModule {}
