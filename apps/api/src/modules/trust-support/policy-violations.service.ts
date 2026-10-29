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
import { ProductModerationService } from '../catalog/product-moderation.service';
import { SellerReviewService } from '../sellers/seller-review.service';
import type {
  CreatePolicyReportInput,
  ReviewPolicyReportInput,
  PolicyReportQuery,
} from '@repo/validation';
import type {
  PolicyReportListItemDto,
  PolicyReportDetailDto,
  PaginatedPolicyReportsDto,
} from '@repo/api-contracts';

const INTERNAL_ROLES = ['SUPER_ADMIN', 'MARKETPLACE_MANAGER', 'TRUST_SAFETY'];

@Injectable()
export class PolicyViolationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(ProductModerationService)
    private readonly productModerationService: ProductModerationService,
    @Inject(SellerReviewService)
    private readonly sellerReviewService: SellerReviewService,
  ) {}

  private isInternalStaff(role: string): boolean {
    return INTERNAL_ROLES.includes(role);
  }

  /**
   * Submits a policy violation report against a product, seller, or review.
   * INVARIANT: A report is an allegation, NOT proof. No automatic bans or removals are executed here.
   */
  async submitReport(
    reporterId: string | null,
    input: CreatePolicyReportInput,
  ): Promise<PolicyReportDetailDto> {
    // 1. Verify target entity exists
    if (input.targetType === 'PRODUCT') {
      const [product] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.products)
        .where(eq(this.databaseService.schema.products.id, input.targetId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${input.targetId} not found`);
      }
    } else if (input.targetType === 'SELLER') {
      const [seller] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.sellerProfiles)
        .where(eq(this.databaseService.schema.sellerProfiles.id, input.targetId))
        .limit(1);

      if (!seller) {
        throw new NotFoundException(`Seller with ID ${input.targetId} not found`);
      }
    } else if (input.targetType === 'REVIEW') {
      const [review] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.reviews)
        .where(eq(this.databaseService.schema.reviews.id, input.targetId))
        .limit(1);

      if (!review) {
        throw new NotFoundException(`Review with ID ${input.targetId} not found`);
      }
    }

    const reportNumber = `POL-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [report] = await this.databaseService.db
      .insert(this.databaseService.schema.policyReports)
      .values({
        reportNumber,
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        description: input.description,
        evidenceUrls: input.evidenceUrls ?? [],
        status: 'PENDING_REVIEW',
        actionTaken: 'NO_ACTION',
      })
      .returning();

    if (!report) {
      throw new BadRequestException('Failed to submit policy report');
    }

    await this.auditService.logEvent({
      actorId: reporterId ?? 'ANONYMOUS_REPORTER',
      actorRole: reporterId ? 'USER' : 'GUEST',
      action: 'POLICY_REPORT_SUBMITTED',
      resourceType: 'POLICY_REPORT',
      resourceId: report.id,
      metadata: {
        reportNumber: report.reportNumber,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      },
    });

    return this.getReport(report.id);
  }

  /**
   * Lists policy reports with filters for authorized trust & safety staff.
   */
  async listReports(query: PolicyReportQuery): Promise<PaginatedPolicyReportsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.policyReports.status, query.status));
    }

    if (query.targetType) {
      conditions.push(eq(this.databaseService.schema.policyReports.targetType, query.targetType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)` })
      .from(this.databaseService.schema.policyReports)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.policyReports.id,
        reportNumber: this.databaseService.schema.policyReports.reportNumber,
        reporterId: this.databaseService.schema.policyReports.reporterId,
        reporterFirstName: this.databaseService.schema.users.firstName,
        reporterLastName: this.databaseService.schema.users.lastName,
        targetType: this.databaseService.schema.policyReports.targetType,
        targetId: this.databaseService.schema.policyReports.targetId,
        reason: this.databaseService.schema.policyReports.reason,
        status: this.databaseService.schema.policyReports.status,
        actionTaken: this.databaseService.schema.policyReports.actionTaken,
        createdAt: this.databaseService.schema.policyReports.createdAt,
      })
      .from(this.databaseService.schema.policyReports)
      .leftJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.policyReports.reporterId, this.databaseService.schema.users.id),
      )
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.policyReports.createdAt))
      .limit(limit)
      .offset(offset);

    const reports: PolicyReportListItemDto[] = rows.map((r) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      reporterId: r.reporterId,
      reporterName: r.reporterFirstName
        ? `${r.reporterFirstName} ${r.reporterLastName}`.trim()
        : 'Anonymous Reporter',
      targetType: r.targetType,
      targetId: r.targetId,
      targetTitle: null,
      reason: r.reason,
      status: r.status,
      actionTaken: r.actionTaken,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single policy report details.
   */
  async getReport(reportId: string): Promise<PolicyReportDetailDto> {
    const [report] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.policyReports.id,
        reportNumber: this.databaseService.schema.policyReports.reportNumber,
        reporterId: this.databaseService.schema.policyReports.reporterId,
        reporterFirstName: this.databaseService.schema.users.firstName,
        reporterLastName: this.databaseService.schema.users.lastName,
        targetType: this.databaseService.schema.policyReports.targetType,
        targetId: this.databaseService.schema.policyReports.targetId,
        reason: this.databaseService.schema.policyReports.reason,
        description: this.databaseService.schema.policyReports.description,
        evidenceUrls: this.databaseService.schema.policyReports.evidenceUrls,
        status: this.databaseService.schema.policyReports.status,
        assignedReviewerId: this.databaseService.schema.policyReports.assignedReviewerId,
        reviewNotes: this.databaseService.schema.policyReports.reviewNotes,
        actionTaken: this.databaseService.schema.policyReports.actionTaken,
        resolvedAt: this.databaseService.schema.policyReports.resolvedAt,
        createdAt: this.databaseService.schema.policyReports.createdAt,
        updatedAt: this.databaseService.schema.policyReports.updatedAt,
      })
      .from(this.databaseService.schema.policyReports)
      .leftJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.policyReports.reporterId, this.databaseService.schema.users.id),
      )
      .where(eq(this.databaseService.schema.policyReports.id, reportId))
      .limit(1);

    if (!report) {
      throw new NotFoundException(`Policy report with ID ${reportId} not found`);
    }

    return {
      id: report.id,
      reportNumber: report.reportNumber,
      reporterId: report.reporterId,
      reporterName: report.reporterFirstName
        ? `${report.reporterFirstName} ${report.reporterLastName}`.trim()
        : 'Anonymous Reporter',
      targetType: report.targetType,
      targetId: report.targetId,
      targetTitle: null,
      reason: report.reason,
      description: report.description,
      evidenceUrls: report.evidenceUrls ?? [],
      status: report.status,
      assignedReviewerId: report.assignedReviewerId,
      assignedReviewerName: null,
      reviewNotes: report.reviewNotes,
      actionTaken: report.actionTaken,
      resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  /**
   * Reviews a policy report and applies administrative outcomes through approved workflows.
   */
  async reviewReport(
    reportId: string,
    reviewerId: string,
    reviewerRole: string,
    input: ReviewPolicyReportInput,
  ): Promise<PolicyReportDetailDto> {
    if (!this.isInternalStaff(reviewerRole)) {
      throw new ForbiddenException('Only internal Trust & Safety staff can review policy reports');
    }

    const [report] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.policyReports)
      .where(eq(this.databaseService.schema.policyReports.id, reportId))
      .limit(1);

    if (!report) {
      throw new NotFoundException(`Policy report with ID ${reportId} not found`);
    }

    // Connects to existing moderation and review domain engines
    if (input.actionTaken === 'LISTING_REMOVED' && report.targetType === 'PRODUCT') {
      await this.productModerationService.moderateProduct(
        report.targetId,
        reviewerId,
        reviewerRole,
        {
          decision: 'REJECTED',
          notes: `Listing removed following policy report ${report.reportNumber}: ${input.reviewNotes}`,
          reasonCode: 'POLICY_VIOLATION',
        },
      );
    } else if (input.actionTaken === 'SELLER_SUSPENDED' && report.targetType === 'SELLER') {
      await this.sellerReviewService.suspendSeller(
        report.targetId,
        reviewerId,
        reviewerRole,
        {
          reason: `Seller suspended following policy report ${report.reportNumber}: ${input.reviewNotes}`,
        },
      );
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.policyReports)
      .set({
        status: input.status,
        actionTaken: input.actionTaken,
        reviewNotes: input.reviewNotes,
        assignedReviewerId: reviewerId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.policyReports.id, reportId));

    await this.auditService.logEvent({
      actorId: reviewerId,
      actorRole: reviewerRole,
      action: 'POLICY_REPORT_REVIEWED',
      resourceType: 'POLICY_REPORT',
      resourceId: reportId,
      metadata: {
        reportNumber: report.reportNumber,
        actionTaken: input.actionTaken,
        status: input.status,
      },
    });

    return this.getReport(reportId);
  }
}
