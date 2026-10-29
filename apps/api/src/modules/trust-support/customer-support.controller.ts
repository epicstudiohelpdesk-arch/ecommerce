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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUserPayload } from '../../common/decorators/current-user.decorator';
import { SupportCasesService } from './support-cases.service';
import { DisputesService } from './disputes.service';
import { PolicyViolationsService } from './policy-violations.service';
import { PrivacyComplianceService } from './privacy-compliance.service';
import {
  createSupportTicketSchema,
  supportTicketQuerySchema,
  createTicketMessageSchema,
  createDisputeSchema,
  disputeQuerySchema,
  createPolicyReportSchema,
  createPrivacyRequestSchema,
  privacyRequestQuerySchema,
} from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

function getUserRole(user: AuthenticatedUserPayload): string {
  return user.roles[0] ?? 'CUSTOMER';
}

@Controller('support')
export class CustomerSupportController {
  constructor(
    @Inject(SupportCasesService)
    private readonly supportCasesService: SupportCasesService,
    @Inject(DisputesService)
    private readonly disputesService: DisputesService,
    @Inject(PolicyViolationsService)
    private readonly policyViolationsService: PolicyViolationsService,
    @Inject(PrivacyComplianceService)
    private readonly privacyComplianceService: PrivacyComplianceService,
  ) {}

  // ==========================================
  // TICKETS
  // ==========================================

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  async createTicket(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
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
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(ticket);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
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
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(result);
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  async getTicket(@CurrentUser() user: AuthenticatedUserPayload, @Param('id') id: string) {
    const ticket = await this.supportCasesService.getTicket(id, user.id, getUserRole(user));
    return createSuccessResponse(ticket);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
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
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(message);
  }

  // ==========================================
  // DISPUTES
  // ==========================================

  @Post('disputes')
  @UseGuards(JwtAuthGuard)
  async createDispute(@CurrentUser() user: AuthenticatedUserPayload, @Body() rawBody: unknown) {
    const parseResult = createDisputeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid dispute payload',
        details: parseResult.error.format(),
      });
    }

    const dispute = await this.disputesService.createDispute(user.id, parseResult.data);
    return createSuccessResponse(dispute);
  }

  @Get('disputes')
  @UseGuards(JwtAuthGuard)
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
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(result);
  }

  @Get('disputes/:id')
  @UseGuards(JwtAuthGuard)
  async getDispute(@CurrentUser() user: AuthenticatedUserPayload, @Param('id') id: string) {
    const dispute = await this.disputesService.getDispute(id, user.id, getUserRole(user));
    return createSuccessResponse(dispute);
  }

  // ==========================================
  // POLICY REPORTS
  // ==========================================

  @Post('reports')
  async submitPolicyReport(
    @CurrentUser() user: AuthenticatedUserPayload | null,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createPolicyReportSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid policy report payload',
        details: parseResult.error.format(),
      });
    }

    const report = await this.policyViolationsService.submitReport(
      user?.id ?? null,
      parseResult.data,
    );
    return createSuccessResponse(report);
  }

  // ==========================================
  // PRIVACY & COMPLIANCE
  // ==========================================

  @Post('privacy')
  @UseGuards(JwtAuthGuard)
  async submitPrivacyRequest(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createPrivacyRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid privacy request payload',
        details: parseResult.error.format(),
      });
    }

    const request = await this.privacyComplianceService.submitPrivacyRequest(
      user.id,
      parseResult.data,
    );
    return createSuccessResponse(request);
  }

  @Get('privacy')
  @UseGuards(JwtAuthGuard)
  async listPrivacyRequests(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = privacyRequestQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid privacy query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.privacyComplianceService.listPrivacyRequests(
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(result);
  }

  @Get('privacy/:id')
  @UseGuards(JwtAuthGuard)
  async getPrivacyRequest(@CurrentUser() user: AuthenticatedUserPayload, @Param('id') id: string) {
    const request = await this.privacyComplianceService.getPrivacyRequest(
      id,
      user.id,
      getUserRole(user),
    );
    return createSuccessResponse(request);
  }
}
