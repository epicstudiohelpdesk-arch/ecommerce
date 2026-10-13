import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, sql, and, desc, gte, lte, or, ilike } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { AdminAuditQuery } from '@repo/validation';
import type {
  PaginatedAdminAuditLogsDto,
  AdminAuditLogListItemDto,
  AdminAuditLogDetailDto,
} from '@repo/api-contracts';

@Injectable()
export class AdminAuditService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Search and list immutable audit log records with bounded pagination and filter support.
   */
  async listAuditLogs(query: AdminAuditQuery): Promise<PaginatedAdminAuditLogsDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.actorId) {
      conditions.push(eq(schema.auditLogs.actorId, query.actorId));
    }

    if (query.actorRole) {
      conditions.push(eq(schema.auditLogs.actorRole, query.actorRole));
    }

    if (query.action) {
      conditions.push(eq(schema.auditLogs.action, query.action));
    }

    if (query.resourceType) {
      conditions.push(eq(schema.auditLogs.resourceType, query.resourceType));
    }

    if (query.startDate) {
      conditions.push(gte(schema.auditLogs.createdAt, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(schema.auditLogs.createdAt, new Date(query.endDate)));
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.auditLogs.action, term),
          ilike(schema.auditLogs.resourceType, term),
          ilike(schema.auditLogs.resourceId, term),
          ilike(schema.users.email, term),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total Count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Rows
    const rows = await db
      .select({
        id: schema.auditLogs.id,
        actorId: schema.auditLogs.actorId,
        actorEmail: schema.users.email,
        actorRole: schema.auditLogs.actorRole,
        action: schema.auditLogs.action,
        resourceType: schema.auditLogs.resourceType,
        resourceId: schema.auditLogs.resourceId,
        ipAddress: schema.auditLogs.ipAddress,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const items: AdminAuditLogListItemDto[] = rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Retrieves full details and before/after state diff for an audit record.
   */
  async getAuditLogDetail(logId: string): Promise<AdminAuditLogDetailDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const [row] = await db
      .select({
        id: schema.auditLogs.id,
        actorId: schema.auditLogs.actorId,
        actorEmail: schema.users.email,
        actorRole: schema.auditLogs.actorRole,
        action: schema.auditLogs.action,
        resourceType: schema.auditLogs.resourceType,
        resourceId: schema.auditLogs.resourceId,
        ipAddress: schema.auditLogs.ipAddress,
        userAgent: schema.auditLogs.userAgent,
        beforeState: schema.auditLogs.beforeState,
        afterState: schema.auditLogs.afterState,
        metadata: schema.auditLogs.metadata,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
      .where(eq(schema.auditLogs.id, logId))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Audit log entry ${logId} not found`);
    }

    return {
      id: row.id,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      beforeState: (row.beforeState ?? null) as Record<string, unknown> | null,
      afterState: (row.afterState ?? null) as Record<string, unknown> | null,
      metadata: (row.metadata ?? null) as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
