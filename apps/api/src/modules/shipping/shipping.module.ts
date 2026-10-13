import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { ShippingService } from './shipping.service';
import { DelhiveryProvider } from './providers/delhivery.provider';
import { MockCourierProvider } from './providers/mock-courier.provider';
import { SellerShippingController } from './seller-shipping.controller';
import { CustomerTrackingController } from './customer-tracking.controller';
import { ShippingWebhookController } from './shipping-webhook.controller';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [SellerShippingController, CustomerTrackingController, ShippingWebhookController],
  providers: [ShippingService, DelhiveryProvider, MockCourierProvider],
  exports: [ShippingService, DelhiveryProvider, MockCourierProvider],
})
export class ShippingModule {}
