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
import { AdminOrdersService } from './admin-orders.service';
import { adminOrderQuerySchema } from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'SUPER_ADMIN',
  'MARKETPLACE_MANAGER',
  'FINANCE_CONTROLLER',
  'CUSTOMER_SUPPORT',
  'READ_ONLY_ANALYST',
)
export class AdminOrdersController {
  constructor(
    @Inject(AdminOrdersService)
    private readonly ordersService: AdminOrdersService,
  ) {}

  @Get()
  async listOrders(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = adminOrderQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      search: rawQuery['search'],
      orderStatus: rawQuery['orderStatus'],
      paymentStatus: rawQuery['paymentStatus'],
      startDate: rawQuery['startDate'],
      endDate: rawQuery['endDate'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid order query parameters',
        details: parseResult.error.format(),
      });
    }

    const { items, meta } = await this.ordersService.listOrders(parseResult.data);
    return createSuccessResponse({ items, ...meta });
  }

  @Get(':orderId')
  async getOrderDetail(@Param('orderId') orderId: string) {
    const detail = await this.ordersService.getOrderDetail(orderId);
    return createSuccessResponse(detail);
  }
}
