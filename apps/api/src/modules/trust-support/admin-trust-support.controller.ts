import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PolicyViolationsService } from './policy-violations.service';
import { RiskReviewService } from './risk-review.service';
import { PrivacyComplianceService } from './privacy-compliance.service';
import {
  supportTicketQuerySchema,
  createTicketMessageSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
  escalateTicketSchema,
  disputeQuerySchema,
  resolveDisputeSchema,
  policyReportQuerySchema,
  reviewPolicyReportSchema,
  createRiskCaseSchema,
  riskCaseQuerySchema,
  reviewRiskCaseSchema,
  privacyRequestQuerySchema,
  processPrivacyRequestSchema,
} from '@repo/validation';
import { createSuccessResponse } from '@repo/api-contracts';

function getUserRole(user: AuthenticatedUserPayload): string {
  return user.roles[0] ?? 'SUPER_ADMIN';
}

@Controller('admin/trust')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminTrustSupportController {
  constructor(
    @Inject(SupportCasesService)
    private readonly supportCasesService: SupportCasesService,
    @Inject(DisputesService)
    private readonly disputesService: DisputesService,
    @Inject(PolicyViolationsService)
    private readonly policyViolationsService: PolicyViolationsService,
    @Inject(RiskReviewService)
    private readonly riskReviewService: RiskReviewService,
    @Inject(PrivacyComplianceService)
    private readonly privacyComplianceService: PrivacyComplianceService,
  ) {}

  // ==========================================
  // TICKETS OPERATIONAL WORKSPACE
  // ==========================================

  @Get('tickets')
  @Roles(
    'SUPER_ADMIN',
    'MARKETPLACE_MANAGER',
    'CUSTOMER_SUPPORT',
    'TRUST_SAFETY',
    'READ_ONLY_ANALYST',
  )
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
  @Roles(
    'SUPER_ADMIN',
    'MARKETPLACE_MANAGER',
    'CUSTOMER_SUPPORT',
    'TRUST_SAFETY',
    'READ_ONLY_ANALYST',
  )
  async getTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const ticket = await this.supportCasesService.getTicket(id, user.id, getUserRole(user));
    return createSuccessResponse(ticket);
  }

  @Post('tickets/:id/messages')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'TRUST_SAFETY')
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

  @Patch('tickets/:id/status')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'TRUST_SAFETY')
  async updateTicketStatus(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = updateTicketStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid ticket status update payload',
        details: parseResult.error.format(),
      });
    }

    const ticket = await this.supportCasesService.updateStatus(
      id,
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(ticket);
  }

  @Patch('tickets/:id/assign')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'TRUST_SAFETY')
  async assignTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = assignTicketSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid assign ticket payload',
        details: parseResult.error.format(),
      });
    }

    const ticket = await this.supportCasesService.assignTicket(
      id,
      user.id,
      getUserRole(user),
      parseResult.data.agentId,
    );
    return createSuccessResponse(ticket);
  }

  @Post('tickets/:id/escalate')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'TRUST_SAFETY')
  async escalateTicket(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = escalateTicketSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid escalate ticket payload',
        details: parseResult.error.format(),
      });
    }

    const ticket = await this.supportCasesService.escalateTicket(
      id,
      user.id,
      getUserRole(user),
      parseResult.data.reason,
    );
    return createSuccessResponse(ticket);
  }

  // ==========================================
  // DISPUTES OPERATIONAL WORKSPACE
  // ==========================================

  @Get('disputes')
  @Roles(
    'SUPER_ADMIN',
    'MARKETPLACE_MANAGER',
    'CUSTOMER_SUPPORT',
    'TRUST_SAFETY',
    'READ_ONLY_ANALYST',
  )
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
  @Roles(
    'SUPER_ADMIN',
    'MARKETPLACE_MANAGER',
    'CUSTOMER_SUPPORT',
    'TRUST_SAFETY',
    'READ_ONLY_ANALYST',
  )
  async getDispute(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const dispute = await this.disputesService.getDispute(id, user.id, getUserRole(user));
    return createSuccessResponse(dispute);
  }

  @Post('disputes/:id/resolve')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'CUSTOMER_SUPPORT', 'TRUST_SAFETY')
  async resolveDispute(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = resolveDisputeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid resolve dispute payload',
        details: parseResult.error.format(),
      });
    }

    const dispute = await this.disputesService.resolveDispute(
      id,
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(dispute);
  }

  // ==========================================
  // POLICY REPORTS WORKSPACE
  // ==========================================

  @Get('reports')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'TRUST_SAFETY')
  async listPolicyReports(@Query() rawQuery: Record<string, string | undefined>) {
    const parseResult = policyReportQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid report query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.policyViolationsService.listReports(parseResult.data);
    return createSuccessResponse(result);
  }

  @Get('reports/:id')
  @Roles('SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'TRUST_SAFETY')
  async getPolicyReport(@Param('id') id: string) {
    const report = await this.policyViolationsService.getReport(id);
    return createSuccessResponse(report);
  }

  @Post('reports/:id/review')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async reviewPolicyReport(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = reviewPolicyReportSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid review report payload',
        details: parseResult.error.format(),
      });
    }

    const report = await this.policyViolationsService.reviewReport(
      id,
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(report);
  }

  // ==========================================
  // RISK & SUSPICIOUS-ACTIVITY WORKSPACE
  // ==========================================

  @Get('risk-cases')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async listRiskCases(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const parseResult = riskCaseQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid risk query parameters',
        details: parseResult.error.format(),
      });
    }

    const result = await this.riskReviewService.listRiskCases(getUserRole(user), parseResult.data);
    return createSuccessResponse(result);
  }

  @Get('risk-cases/:id')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async getRiskCase(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const riskCase = await this.riskReviewService.getRiskCase(id, getUserRole(user));
    return createSuccessResponse(riskCase);
  }

  @Post('risk-cases')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async createRiskCase(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() rawBody: unknown,
  ) {
    const parseResult = createRiskCaseSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid risk case payload',
        details: parseResult.error.format(),
      });
    }

    const riskCase = await this.riskReviewService.createRiskCase(
      user.id,
      parseResult.data,
    );
    return createSuccessResponse(riskCase);
  }

  @Post('risk-cases/:id/review')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async reviewRiskCase(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = reviewRiskCaseSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid review risk case payload',
        details: parseResult.error.format(),
      });
    }

    const riskCase = await this.riskReviewService.reviewRiskCase(
      id,
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(riskCase);
  }

  // ==========================================
  // PRIVACY & COMPLIANCE WORKSPACE
  // ==========================================

  @Get('privacy-requests')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
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

  @Get('privacy-requests/:id')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async getPrivacyRequest(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
  ) {
    const request = await this.privacyComplianceService.getPrivacyRequest(
      id,
      user.id,
      getUserRole(user),
    );
    return createSuccessResponse(request);
  }

  @Post('privacy-requests/:id/process')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY')
  async processPrivacyRequest(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id') id: string,
    @Body() rawBody: unknown,
  ) {
    const parseResult = processPrivacyRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Invalid process privacy request payload',
        details: parseResult.error.format(),
      });
    }

    const request = await this.privacyComplianceService.processPrivacyRequest(
      id,
      user.id,
      getUserRole(user),
      parseResult.data,
    );
    return createSuccessResponse(request);
  }
}
