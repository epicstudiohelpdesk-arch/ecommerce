import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SellersModule } from '../sellers/sellers.module';

import { SupportCasesService } from './support-cases.service';
import { DisputesService } from './disputes.service';
import { PolicyViolationsService } from './policy-violations.service';
import { RiskReviewService } from './risk-review.service';
import { PrivacyComplianceService } from './privacy-compliance.service';

import { CustomerSupportController } from './customer-support.controller';
import { SellerSupportController } from './seller-support.controller';
import { AdminTrustSupportController } from './admin-trust-support.controller';

@Module({
  imports: [DatabaseModule, AuditModule, PaymentsModule, CatalogModule, SellersModule],
  controllers: [CustomerSupportController, SellerSupportController, AdminTrustSupportController],
  providers: [
    SupportCasesService,
    DisputesService,
    PolicyViolationsService,
    RiskReviewService,
    PrivacyComplianceService,
  ],
  exports: [
    SupportCasesService,
    DisputesService,
    PolicyViolationsService,
    RiskReviewService,
    PrivacyComplianceService,
  ],
})
export class TrustSupportModule {}
