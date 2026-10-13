import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SellerOrdersService } from './seller-orders.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { listSellerOrdersQuerySchema, updateSubOrderStatusSchema } from '@repo/validation';

@Controller('seller/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('APPROVED_SELLER', 'SELLER_OWNER', 'SUPER_ADMIN')
export class SellerOrdersController {
  constructor(
    @Inject(SellerOrdersService)
    private readonly ordersService: SellerOrdersService,
  ) {}

  @Get()
  async listOrders(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = listSellerOrdersQuerySchema.safeParse({
      page: rawQuery['page'] ? parseInt(rawQuery['page'], 10) : undefined,
      limit: rawQuery['limit'] ? parseInt(rawQuery['limit'], 10) : undefined,
      status: rawQuery['status'],
      search: rawQuery['search'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid orders query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.ordersService.listSellerOrders(user.id, parseResult.data);
    return createSuccessResponse(result);
  }

  @Get(':subOrderId')
  async getOrderDetail(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
  ) {
    const order = await this.ordersService.getSellerOrderDetail(user.id, subOrderId);
    return createSuccessResponse(order);
  }

  @Patch(':subOrderId/status')
  @Post(':subOrderId/transition')
  async updateOrderStatus(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = updateSubOrderStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid order status update parameters',
        details: parseResult.error.format(),
      });
    }

    const updated = await this.ordersService.updateSubOrderStatus(
      user.id,
      subOrderId,
      parseResult.data,
    );
    return createSuccessResponse(updated);
  }
}
