import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { ShippingService } from './shipping.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { bookShipmentSchema, schedulePickupSchema, cancelShipmentSchema } from '@repo/validation';

@Controller('seller/orders/:subOrderId/shipment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('APPROVED_SELLER', 'SELLER_OWNER', 'SUPER_ADMIN')
export class SellerShippingController {
  constructor(
    @Inject(ShippingService)
    private readonly shippingService: ShippingService,
  ) {}

  @Post('book')
  async bookShipment(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = bookShipmentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid shipment booking parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.shippingService.bookShipment(user.id, subOrderId, parseResult.data);
    return createSuccessResponse(result);
  }

  @Get()
  async getShipment(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
  ) {
    const result = await this.shippingService.getSellerShipment(user.id, subOrderId);
    return createSuccessResponse(result);
  }

  @Get('label')
  async getShippingLabel(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
  ) {
    const result = await this.shippingService.getShippingLabel(user.id, subOrderId);
    return createSuccessResponse(result);
  }

  @Post('pickup')
  async schedulePickup(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = schedulePickupSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid pickup scheduling parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.shippingService.schedulePickup(user.id, subOrderId, parseResult.data);
    return createSuccessResponse(result);
  }

  @Post('cancel')
  async cancelShipment(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('subOrderId') subOrderId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = cancelShipmentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid shipment cancellation parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.shippingService.cancelShipment(user.id, subOrderId, parseResult.data);
    return createSuccessResponse(result);
  }
}
