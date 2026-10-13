import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditService } from './admin-audit.service';
import { adminAuditQuerySchema } from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY', 'FINANCE_CONTROLLER')
export class AdminAuditController {
  constructor(
    @Inject(AdminAuditService)
    private readonly auditService: AdminAuditService,
  ) {}

  @Get('logs')
  async listAuditLogs(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = adminAuditQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      search: rawQuery['search'],
      actorId: rawQuery['actorId'],
      actorRole: rawQuery['actorRole'],
      action: rawQuery['action'],
      resourceType: rawQuery['resourceType'],
      startDate: rawQuery['startDate'],
      endDate: rawQuery['endDate'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid audit query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.auditService.listAuditLogs(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Get('logs/:logId')
  async getAuditLogDetail(@Param('logId') logId: string) {
    const detail = await this.auditService.getAuditLogDetail(logId);
    return createSuccessResponse(detail);
  }
}
