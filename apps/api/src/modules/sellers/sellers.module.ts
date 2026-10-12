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

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [SellerOnboardingController, AdminSellerReviewController],
  providers: [
    SellerDocumentsStorageService,
    SellerEligibilityService,
    SellerOnboardingService,
    SellerReviewService,
  ],
  exports: [
    SellerEligibilityService,
    SellerOnboardingService,
    SellerReviewService,
    SellerDocumentsStorageService,
  ],
})
export class SellersModule {}
