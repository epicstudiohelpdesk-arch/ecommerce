import {
  Controller,
  Post,
  Param,
  Req,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import { ShippingService } from './shipping.service';
import { trackingWebhookPayloadSchema } from '@repo/validation';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer | string;
}

@Controller('shipping/webhooks')
export class ShippingWebhookController {
  constructor(
    @Inject(ShippingService)
    private readonly shippingService: ShippingService,
  ) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Param('provider') provider: string, @Req() req: Request) {
    const normalizedProvider = provider.toUpperCase();
    if (
      normalizedProvider !== 'DELHIVERY' &&
      normalizedProvider !== 'MOCK_COURIER' &&
      normalizedProvider !== 'SHIPROCKET' &&
      normalizedProvider !== 'BLUEDART'
    ) {
      throw new BadRequestException(`Unsupported shipping provider: ${provider}`);
    }

    const signature =
      (req.headers['x-delhivery-signature'] as string) ||
      (req.headers['x-courier-signature'] as string) ||
      (req.headers['x-signature'] as string);

    if (!signature) {
      throw new UnauthorizedException('Missing cryptographic webhook signature header');
    }

    const reqWithRaw = req as RequestWithRawBody;
    const rawBody =
      reqWithRaw.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!rawBody) {
      throw new BadRequestException('Empty webhook payload');
    }

    const bodyObj =
      typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody.toString());

    const parseResult = trackingWebhookPayloadSchema.safeParse(bodyObj);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid tracking webhook payload structure',
        details: parseResult.error.format(),
      });
    }

    const result = await this.shippingService.processTrackingWebhook(
      normalizedProvider,
      rawBody,
      signature,
      parseResult.data,
    );

    return result;
  }
}
