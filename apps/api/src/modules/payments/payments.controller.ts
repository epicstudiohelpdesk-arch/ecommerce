import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentSchema, VerifyPaymentSchema, RefundRequestSchema } from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Initiates payment for an eligible customer order.
   */
  @Post('initiate')
  async initiatePayment(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = InitiatePaymentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid payment initiation parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.paymentsService.initiatePayment(user.id, parseResult.data);
    return createSuccessResponse(result);
  }

  /**
   * Verifies client-side payment completion callback (Razorpay/Stripe checkout response).
   */
  @Post('verify')
  async verifyPayment(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = VerifyPaymentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid payment verification parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.paymentsService.verifyClientPayment(user.id, parseResult.data);
    return createSuccessResponse(result);
  }

  /**
   * Retrieves live payment status and attempts history for an order.
   */
  @Get('order/:orderNumber/status')
  async getPaymentStatus(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderNumber') orderNumber: string,
  ) {
    const status = await this.paymentsService.getOrderPaymentStatus(user.id, orderNumber);
    return createSuccessResponse(status);
  }

  /**
   * Requests a refund for a purchased artisan sub-order.
   */
  @Post('refund')
  async requestRefund(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = RefundRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid refund request parameters',
        details: parseResult.error.format(),
      });
    }

    const refund = await this.paymentsService.requestRefund(user.id, parseResult.data);
    return createSuccessResponse(refund);
  }
}
