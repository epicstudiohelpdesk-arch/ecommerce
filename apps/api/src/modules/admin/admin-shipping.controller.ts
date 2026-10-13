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
import { AdminShippingService } from './admin-shipping.service';
import { adminShipmentQuerySchema } from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/shipping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'READ_ONLY_ANALYST')
export class AdminShippingController {
  constructor(
    @Inject(AdminShippingService)
    private readonly shippingService: AdminShippingService,
  ) {}

  @Get('shipments')
  async listShipments(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = adminShipmentQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      search: rawQuery['search'],
      status: rawQuery['status'],
      carrier: rawQuery['carrier'],
      hasException: rawQuery['hasException'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid shipment query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.shippingService.listShipments(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Get('shipments/:shipmentId')
  async getShipmentDetail(@Param('shipmentId') shipmentId: string) {
    const detail = await this.shippingService.getShipmentDetail(shipmentId);
    return createSuccessResponse(detail);
  }
}
