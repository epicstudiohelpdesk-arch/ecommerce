import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsService } from './payments.service';
import { CommissionService } from './commission.service';
import { ReconciliationService } from './reconciliation.service';
import { RazorpayPaymentProvider } from './providers/razorpay.provider';
import { StripePaymentProvider } from './providers/stripe.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PaymentsController } from './payments.controller';
import { PaymentWebhookController } from './webhook.controller';
import { AdminFinanceController } from './admin-finance.controller';

@Module({
  imports: [DatabaseModule, AuditModule, LedgerModule],
  controllers: [PaymentsController, PaymentWebhookController, AdminFinanceController],
  providers: [
    PaymentsService,
    CommissionService,
    ReconciliationService,
    RazorpayPaymentProvider,
    StripePaymentProvider,
    MockPaymentProvider,
  ],
  exports: [PaymentsService, CommissionService, ReconciliationService],
})
export class PaymentsModule {}
