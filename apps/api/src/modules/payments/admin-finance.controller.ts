import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ReconciliationService } from './reconciliation.service';
import { PaymentsService } from './payments.service';
import { ProcessRefundSchema } from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard)
export class AdminFinanceController {
  constructor(
    @Inject(ReconciliationService)
    private readonly reconciliationService: ReconciliationService,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Executes reconciliation audit across payment attempts, webhooks, and ledger balance invariants.
   */
  @Get('reconciliation')
  async getReconciliationReport() {
    const report = await this.reconciliationService.runReconciliationAudit();
    return createSuccessResponse(report);
  }

  /**
   * Approves or rejects an artisan sub-order refund request.
   */
  @Post('refunds/:refundId/process')
  async processRefund(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('refundId') refundId: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = ProcessRefundSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Invalid refund approval parameters',
        details: parseResult.error.format(),
      });
    }

    const refund = await this.paymentsService.processRefund(user.id, refundId, parseResult.data);
    return createSuccessResponse(refund);
  }
}
