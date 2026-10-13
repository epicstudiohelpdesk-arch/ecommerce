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
import { PaymentsService } from './payments.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer | string;
}

@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Authoritative webhook ingestion endpoint for payment providers (Razorpay, Stripe).
   */
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Param('provider') provider: string, @Req() req: Request) {
    const normalizedProvider = provider.toUpperCase();
    if (normalizedProvider !== 'RAZORPAY' && normalizedProvider !== 'STRIPE') {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }

    // Extract signature header
    const signature =
      (req.headers['x-razorpay-signature'] as string) ||
      (req.headers['stripe-signature'] as string) ||
      (req.headers['x-signature'] as string);

    if (!signature) {
      throw new UnauthorizedException('Missing cryptographic webhook signature header');
    }

    // Extract raw payload body
    const reqWithRaw = req as RequestWithRawBody;
    const rawBody =
      reqWithRaw.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!rawBody) {
      throw new BadRequestException('Empty webhook payload');
    }

    const result = await this.paymentsService.processWebhook(
      normalizedProvider as 'RAZORPAY' | 'STRIPE',
      rawBody,
      signature,
    );

    return result;
  }
}
