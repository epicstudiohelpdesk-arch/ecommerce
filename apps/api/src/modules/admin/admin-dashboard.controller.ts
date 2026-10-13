import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'SUPER_ADMIN',
  'MARKETPLACE_MANAGER',
  'FINANCE_CONTROLLER',
  'TRUST_SAFETY',
  'CUSTOMER_SUPPORT',
  'READ_ONLY_ANALYST',
)
export class AdminDashboardController {
  constructor(
    @Inject(AdminDashboardService)
    private readonly dashboardService: AdminDashboardService,
  ) {}

  @Get('metrics')
  async getMetrics() {
    const metrics = await this.dashboardService.getMetrics();
    return createSuccessResponse(metrics);
  }
}
