import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AddressService } from './address.service';
import { PricingService } from './pricing.service';
import { CheckoutService } from './checkout.service';
import { AddressController } from './address.controller';
import { CheckoutController } from './checkout.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, CartModule, CatalogModule],
  controllers: [AddressController, CheckoutController],
  providers: [AddressService, PricingService, CheckoutService],
  exports: [AddressService, PricingService, CheckoutService],
})
export class CheckoutModule {}
