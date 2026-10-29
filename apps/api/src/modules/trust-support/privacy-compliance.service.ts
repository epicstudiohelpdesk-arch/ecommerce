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
import type {
  CreatePrivacyRequestInput,
  ProcessPrivacyRequestInput,
  PrivacyRequestQuery,
} from '@repo/validation';
import type {
  PrivacyRequestListItemDto,
  PrivacyRequestDetailDto,
  PaginatedPrivacyRequestsDto,
} from '@repo/api-contracts';

const PRIVILEGED_PRIVACY_ROLES = ['SUPER_ADMIN', 'TRUST_SAFETY'];

@Injectable()
export class PrivacyComplianceService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private isPrivilegedStaff(role: string): boolean {
    return PRIVILEGED_PRIVACY_ROLES.includes(role);
  }

  /**
   * Submits a data subject privacy request under DPDP Act / GDPR.
   */
  async submitPrivacyRequest(
    userId: string,
    input: CreatePrivacyRequestInput,
  ): Promise<PrivacyRequestDetailDto> {
    const requestNumber = `PRV-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [request] = await this.databaseService.db
      .insert(this.databaseService.schema.privacyRequests)
      .values({
        requestNumber,
        userId,
        requestType: input.requestType,
        status: 'SUBMITTED',
        reason: input.reason ?? null,
      })
      .returning();

    if (!request) {
      throw new BadRequestException('Failed to submit privacy request');
    }

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'PRIVACY_REQUEST_SUBMITTED',
      resourceType: 'PRIVACY_REQUEST',
      resourceId: request.id,
      metadata: {
        requestNumber: request.requestNumber,
        requestType: input.requestType,
      },
    });

    return this.getPrivacyRequest(request.id, userId, 'CUSTOMER');
  }

  /**
   * Lists privacy requests with tenant isolation for users and queue view for privacy operators.
   */
  async listPrivacyRequests(
    actorId: string,
    role: string,
    query: PrivacyRequestQuery,
  ): Promise<PaginatedPrivacyRequestsDto> {
    const isStaff = this.isPrivilegedStaff(role);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (!isStaff) {
      conditions.push(eq(this.databaseService.schema.privacyRequests.userId, actorId));
    }

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.privacyRequests.status, query.status));
    }

    if (query.requestType) {
      conditions.push(eq(this.databaseService.schema.privacyRequests.requestType, query.requestType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)` })
      .from(this.databaseService.schema.privacyRequests)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.privacyRequests.id,
        requestNumber: this.databaseService.schema.privacyRequests.requestNumber,
        userId: this.databaseService.schema.privacyRequests.userId,
        userFirstName: this.databaseService.schema.users.firstName,
        userLastName: this.databaseService.schema.users.lastName,
        userEmail: this.databaseService.schema.users.email,
        requestType: this.databaseService.schema.privacyRequests.requestType,
        status: this.databaseService.schema.privacyRequests.status,
        createdAt: this.databaseService.schema.privacyRequests.createdAt,
      })
      .from(this.databaseService.schema.privacyRequests)
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.privacyRequests.userId, this.databaseService.schema.users.id),
      )
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.privacyRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const requests: PrivacyRequestListItemDto[] = rows.map((r) => ({
      id: r.id,
      requestNumber: r.requestNumber,
      userId: r.userId,
      userName: `${r.userFirstName} ${r.userLastName}`.trim(),
      userEmail: r.userEmail,
      requestType: r.requestType,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single privacy request detail.
   */
  async getPrivacyRequest(
    requestId: string,
    actorId: string,
    role: string,
  ): Promise<PrivacyRequestDetailDto> {
    const isStaff = this.isPrivilegedStaff(role);

    const [request] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.privacyRequests.id,
        requestNumber: this.databaseService.schema.privacyRequests.requestNumber,
        userId: this.databaseService.schema.privacyRequests.userId,
        userFirstName: this.databaseService.schema.users.firstName,
        userLastName: this.databaseService.schema.users.lastName,
        userEmail: this.databaseService.schema.users.email,
        requestType: this.databaseService.schema.privacyRequests.requestType,
        status: this.databaseService.schema.privacyRequests.status,
        reason: this.databaseService.schema.privacyRequests.reason,
        reviewNotes: this.databaseService.schema.privacyRequests.reviewNotes,
        retentionExemptions: this.databaseService.schema.privacyRequests.retentionExemptions,
        assignedTo: this.databaseService.schema.privacyRequests.assignedTo,
        completedAt: this.databaseService.schema.privacyRequests.completedAt,
        createdAt: this.databaseService.schema.privacyRequests.createdAt,
        updatedAt: this.databaseService.schema.privacyRequests.updatedAt,
      })
      .from(this.databaseService.schema.privacyRequests)
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.privacyRequests.userId, this.databaseService.schema.users.id),
      )
      .where(eq(this.databaseService.schema.privacyRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new NotFoundException(`Privacy request with ID ${requestId} not found`);
    }

    if (!isStaff && request.userId !== actorId) {
      throw new NotFoundException(`Privacy request with ID ${requestId} not found`);
    }

    return {
      id: request.id,
      requestNumber: request.requestNumber,
      userId: request.userId,
      userName: `${request.userFirstName} ${request.userLastName}`.trim(),
      userEmail: request.userEmail,
      requestType: request.requestType,
      status: request.status,
      reason: request.reason,
      reviewNotes: request.reviewNotes,
      retentionExemptions: request.retentionExemptions,
      assignedTo: request.assignedTo,
      assignedStaffName: null,
      completedAt: request.completedAt ? request.completedAt.toISOString() : null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  /**
   * Processes a privacy request.
   * COMPLIANCE INVARIANT: If the request is an approved ACCOUNT_DELETION, personal data
   * is scrubbed according to the Accounting vs. Privacy Balancing Rule (DATA_RETENTION.md),
   * while financial transactions and statutory ledger records are preserved intact.
   */
  async processPrivacyRequest(
    requestId: string,
    staffId: string,
    staffRole: string,
    input: ProcessPrivacyRequestInput,
  ): Promise<PrivacyRequestDetailDto> {
    if (!this.isPrivilegedStaff(staffRole)) {
      throw new ForbiddenException('Only Trust & Safety or SuperAdmin can process compliance requests');
    }

    const [request] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.privacyRequests)
      .where(eq(this.databaseService.schema.privacyRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new NotFoundException(`Privacy request with ID ${requestId} not found`);
    }

    const now = new Date();

    // Execute Balancing Rule for Account Deletion
    if (input.status === 'COMPLETED' && request.requestType === 'ACCOUNT_DELETION') {
      const targetUserId = request.userId;

      // 1. Scrub PII attributes on users table
      await this.databaseService.db
        .update(this.databaseService.schema.users)
        .set({
          email: `anonymized_${targetUserId}@deleted.marketplace.internal`,
          firstName: 'Anonymized',
          lastName: 'User',
          phone: null,
          passwordHash: 'ACCOUNT_DEACTIVATED_TOMBSTONE',
          status: 'DEACTIVATED',
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.users.id, targetUserId));

      // 2. Revoke active user sessions
      await this.databaseService.db
        .delete(this.databaseService.schema.userSessions)
        .where(eq(this.databaseService.schema.userSessions.userId, targetUserId));
    }

    // Update privacy request record
    await this.databaseService.db
      .update(this.databaseService.schema.privacyRequests)
      .set({
        status: input.status,
        reviewNotes: input.reviewNotes,
        retentionExemptions:
          input.retentionExemptions ??
          'Financial ledger entries, tax obligations, and statutory order records retained per DPDP / Tax Compliance Policy.',
        assignedTo: staffId,
        completedAt: input.status === 'COMPLETED' || input.status === 'REJECTED' ? now : null,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.privacyRequests.id, requestId));

    await this.auditService.logEvent({
      actorId: staffId,
      actorRole: staffRole,
      action: 'PRIVACY_REQUEST_PROCESSED',
      resourceType: 'PRIVACY_REQUEST',
      resourceId: requestId,
      metadata: {
        requestNumber: request.requestNumber,
        status: input.status,
        requestType: request.requestType,
      },
    });

    return this.getPrivacyRequest(requestId, staffId, staffRole);
  }
}
