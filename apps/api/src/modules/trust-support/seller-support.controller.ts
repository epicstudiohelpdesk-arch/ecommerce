import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from '../../common/decorators/current-user.decorator';
import { SupportCasesService } from './support-cases.service';
import { DisputesService } from './disputes.service';
import {
  createSupportTicketSchema,
  supportTicketQuerySchema,
  createTicketMessageSchema,
  sellerDisputeResponseSchema,
  disputeQuerySchema,
} from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

@Controller('seller/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SELLER')
export class SellerSupportController {
  constructor(
    @Inject(SupportCasesService)
    private readonly supportCasesService: SupportCasesService,
    @Inject(DisputesService)
    private readonly disputesService: DisputesService,
  ) {}

  // ==========================================
  // SELLER TICKETS
  // ==========================================

  @Post('tickets')
  async createTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createSupportTicketSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid support ticket payload',
        details: parseResult.error.format(),
      });
    }

    const ticket = await this.supportCasesService.createTicket(
      user.id,
      'SELLER',
      parseResult.data,
    );
    return createSuccessResponse(ticket);
  }

  @Get('tickets')
  async listTickets(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = supportTicketQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.supportCasesService.listTickets(
      user.id,
      'SELLER',
      parseResult.data,
    );
    return createSuccessResponse(result);
  }

  @Get('tickets/:id')
  async getTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const ticket = await this.supportCasesService.getTicket(id, user.id, 'SELLER');
    return createSuccessResponse(ticket);
  }

  @Post('tickets/:id/messages')
  async addMessage(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createTicketMessageSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid message payload',
        details: parseResult.error.format(),
      });
    }

    const message = await this.supportCasesService.addMessage(
      id,
      user.id,
      'SELLER',
      parseResult.data,
    );
    return createSuccessResponse(message);
  }

  // ==========================================
  // SELLER DISPUTES
  // ==========================================

  @Get('disputes')
  async listDisputes(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = disputeQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid dispute query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.disputesService.listDisputes(
      user.id,
      'SELLER',
      parseResult.data,
    );
    return createSuccessResponse(result);
  }

  @Get('disputes/:id')
  async getDispute(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const dispute = await this.disputesService.getDispute(id, user.id, 'SELLER');
    return createSuccessResponse(dispute);
  }

  @Post('disputes/:id/respond')
  async submitSellerResponse(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = sellerDisputeResponseSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid dispute response payload',
        details: parseResult.error.format(),
      });
    }

    const dispute = await this.disputesService.submitSellerResponse(
      id,
      user.id,
      parseResult.data,
    );
    return createSuccessResponse(dispute);
  }
}
