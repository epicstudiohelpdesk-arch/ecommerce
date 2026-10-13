import { Controller, Get, Param, Query, BadRequestException, Inject } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { createSuccessResponse } from '@repo/api-contracts';
import { serviceabilityQuerySchema } from '@repo/validation';

@Controller()
export class CustomerTrackingController {
  constructor(
    @Inject(ShippingService)
    private readonly shippingService: ShippingService,
  ) {}

  @Get('orders/:orderNumber/tracking')
  async getOrderTracking(@Param('orderNumber') orderNumber: string) {
    const result = await this.shippingService.getCustomerOrderTracking(orderNumber);
    return createSuccessResponse(result);
  }

  @Get('shipping/track/:trackingNumber')
  async getPublicTracking(@Param('trackingNumber') trackingNumber: string) {
    const result = await this.shippingService.getPublicTracking(trackingNumber);
    return createSuccessResponse(result);
  }

  @Get('shipping/serviceability')
  async checkServiceability(@Query() query: Record<string, string | undefined>) {
    const parseResult = serviceabilityQuerySchema.safeParse({
      originPostalCode: query['originPostalCode'],
      destinationPostalCode: query['destinationPostalCode'],
    });

    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid serviceability query parameters',
        details: parseResult.error.format(),
      });
    }

    const carrierCode = query['carrierCode'];
    const result = await this.shippingService.checkServiceability(
      parseResult.data.originPostalCode,
      parseResult.data.destinationPostalCode,
      carrierCode,
    );
    return createSuccessResponse(result);
  }
}
