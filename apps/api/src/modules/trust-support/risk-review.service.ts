import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { CreateRiskCaseInput, ReviewRiskCaseInput, RiskCaseQuery } from '@repo/validation';
import type {
  RiskCaseListItemDto,
  RiskCaseDetailDto,
  PaginatedRiskCasesDto,
} from '@repo/api-contracts';

const PRIVILEGED_RISK_ROLES = ['SUPER_ADMIN', 'TRUST_SAFETY'];

@Injectable()
export class RiskReviewService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private assertPrivilegedAccess(role: string): void {
    if (!PRIVILEGED_RISK_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Access to risk cases and fraud review queues is strictly restricted to Trust & Safety and SuperAdmin personnel',
      );
    }
  }

  /**
   * Records a potential suspicious activity or risk case for human investigation.
   * INVARIANT: Signals never automatically execute bans or fund withholding.
   */
  async createRiskCase(creatorId: string, input: CreateRiskCaseInput): Promise<RiskCaseDetailDto> {
    const caseNumber = `RSK-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [riskCase] = await this.databaseService.db
      .insert(this.databaseService.schema.riskCases)
      .values({
        caseNumber,
        entityType: input.entityType,
        entityId: input.entityId,
        signalType: input.signalType,
        riskLevel: input.riskLevel ?? 'MEDIUM',
        status: 'OPEN',
        internalNotes: input.internalNotes,
        evidenceSnapshot: input.evidenceSnapshot ?? {},
        actionTaken: 'NONE',
      })
      .returning();

    if (!riskCase) {
      throw new BadRequestException('Failed to create risk review case');
    }

    await this.auditService.logEvent({
      actorId: creatorId,
      actorRole: 'SYSTEM_OR_STAFF',
      action: 'RISK_CASE_CREATED',
      resourceType: 'RISK_CASE',
      resourceId: riskCase.id,
      metadata: {
        caseNumber: riskCase.caseNumber,
        signalType: input.signalType,
        riskLevel: input.riskLevel,
      },
    });

    return {
      id: riskCase.id,
      caseNumber: riskCase.caseNumber,
      entityType: riskCase.entityType,
      entityId: riskCase.entityId,
      signalType: riskCase.signalType,
      riskLevel: riskCase.riskLevel,
      status: riskCase.status,
      assignedInvestigatorId: null,
      assignedInvestigatorName: null,
      evidenceSnapshot: (riskCase.evidenceSnapshot as Record<string, unknown>) ?? null,
      internalNotes: riskCase.internalNotes,
      actionTaken: riskCase.actionTaken,
      resolvedAt: null,
      createdAt: riskCase.createdAt.toISOString(),
      updatedAt: riskCase.updatedAt.toISOString(),
    };
  }

  /**
   * Lists risk review cases. Strictly restricted to Trust & Safety and SuperAdmin.
   */
  async listRiskCases(staffRole: string, query: RiskCaseQuery): Promise<PaginatedRiskCasesDto> {
    this.assertPrivilegedAccess(staffRole);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.riskCases.status, query.status));
    }

    if (query.riskLevel) {
      conditions.push(eq(this.databaseService.schema.riskCases.riskLevel, query.riskLevel));
    }

    if (query.entityType) {
      conditions.push(eq(this.databaseService.schema.riskCases.entityType, query.entityType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)` })
      .from(this.databaseService.schema.riskCases)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.riskCases)
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.riskCases.createdAt))
      .limit(limit)
      .offset(offset);

    const cases: RiskCaseListItemDto[] = rows.map((r) => ({
      id: r.id,
      caseNumber: r.caseNumber,
      entityType: r.entityType,
      entityId: r.entityId,
      signalType: r.signalType,
      riskLevel: r.riskLevel,
      status: r.status,
      actionTaken: r.actionTaken,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      cases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single risk case detail. Strictly restricted to Trust & Safety and SuperAdmin.
   */
  async getRiskCase(caseId: string, staffRole: string): Promise<RiskCaseDetailDto> {
    this.assertPrivilegedAccess(staffRole);

    const [riskCase] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.riskCases)
      .where(eq(this.databaseService.schema.riskCases.id, caseId))
      .limit(1);

    if (!riskCase) {
      throw new NotFoundException(`Risk case with ID ${caseId} not found`);
    }

    return {
      id: riskCase.id,
      caseNumber: riskCase.caseNumber,
      entityType: riskCase.entityType,
      entityId: riskCase.entityId,
      signalType: riskCase.signalType,
      riskLevel: riskCase.riskLevel,
      status: riskCase.status,
      assignedInvestigatorId: riskCase.assignedInvestigatorId,
      assignedInvestigatorName: null,
      evidenceSnapshot: (riskCase.evidenceSnapshot as Record<string, unknown>) ?? null,
      internalNotes: riskCase.internalNotes,
      actionTaken: riskCase.actionTaken,
      resolvedAt: riskCase.resolvedAt ? riskCase.resolvedAt.toISOString() : null,
      createdAt: riskCase.createdAt.toISOString(),
      updatedAt: riskCase.updatedAt.toISOString(),
    };
  }

  /**
   * Reviews a risk case and documents the human decision and outcome.
   */
  async reviewRiskCase(
    caseId: string,
    investigatorId: string,
    staffRole: string,
    input: ReviewRiskCaseInput,
  ): Promise<RiskCaseDetailDto> {
    this.assertPrivilegedAccess(staffRole);

    const [riskCase] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.riskCases)
      .where(eq(this.databaseService.schema.riskCases.id, caseId))
      .limit(1);

    if (!riskCase) {
      throw new NotFoundException(`Risk case with ID ${caseId} not found`);
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.riskCases)
      .set({
        status: input.status,
        actionTaken: input.actionTaken,
        internalNotes: input.internalNotes,
        assignedInvestigatorId: investigatorId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.riskCases.id, caseId));

    await this.auditService.logEvent({
      actorId: investigatorId,
      actorRole: staffRole,
      action: 'RISK_CASE_REVIEWED',
      resourceType: 'RISK_CASE',
      resourceId: caseId,
      metadata: {
        caseNumber: riskCase.caseNumber,
        status: input.status,
        actionTaken: input.actionTaken,
      },
    });

    return this.getRiskCase(caseId, staffRole);
  }
}
