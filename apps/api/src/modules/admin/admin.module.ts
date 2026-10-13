import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';

import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';

import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';

import { AdminShippingService } from './admin-shipping.service';
import { AdminShippingController } from './admin-shipping.controller';

import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';

import { AdminStaffService } from './admin-staff.service';
import { AdminStaffController } from './admin-staff.controller';

@Module({
  imports: [DatabaseModule, AuditModule, PaymentsModule],
  controllers: [
    AdminDashboardController,
    AdminOrdersController,
    AdminShippingController,
    AdminAuditController,
    AdminStaffController,
  ],
  providers: [
    AdminDashboardService,
    AdminOrdersService,
    AdminShippingService,
    AdminAuditService,
    AdminStaffService,
  ],
  exports: [
    AdminDashboardService,
    AdminOrdersService,
    AdminShippingService,
    AdminAuditService,
    AdminStaffService,
  ],
})
export class AdminModule {}
