import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import type {
  AdminStaffQuery,
  CreateStaffUserInput,
  UpdateStaffStatusInput,
} from '@repo/validation';
import type { PaginatedAdminStaffDto, AdminStaffUserDto } from '@repo/api-contracts';

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'MARKETPLACE_MANAGER',
  'FINANCE_CONTROLLER',
  'TRUST_SAFETY',
  'CUSTOMER_SUPPORT',
  'READ_ONLY_ANALYST',
] as const;

@Injectable()
export class AdminStaffService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lists administrative and operational staff users with bounded pagination and role filtering.
   */
  async listStaff(query: AdminStaffQuery): Promise<PaginatedAdminStaffDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const filterRoles = query.role ? [query.role] : [...STAFF_ROLES];

    const conditions = [inArray(schema.roles.name, filterRoles)];

    if (query.status) {
      conditions.push(eq(schema.users.status, query.status));
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${schema.users.email} ILIKE ${term} OR ${schema.users.firstName} ILIKE ${term} OR ${schema.users.lastName} ILIKE ${term})`,
      );
    }

    const whereClause = and(...conditions);

    // Total Count
    const [countResult] = await db
      .select({ count: sql<number>`count(distinct ${schema.users.id})::int` })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Distinct Staff Users
    const staffRows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        status: schema.users.status,
        mfaEnabled: schema.users.mfaEnabled,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(whereClause)
      .groupBy(schema.users.id)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    if (staffRows.length === 0) {
      return {
        items: [],
        meta: { page, limit, total, totalPages },
      };
    }

    const userIds = staffRows.map((u) => u.id);

    // Fetch all roles for these users
    const allUserRoles = await db
      .select({
        userId: schema.userRoles.userId,
        roleName: schema.roles.name,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(inArray(schema.userRoles.userId, userIds));

    const rolesMap = new Map<string, string[]>();
    for (const ur of allUserRoles) {
      const arr = rolesMap.get(ur.userId) ?? [];
      arr.push(ur.roleName);
      rolesMap.set(ur.userId, arr);
    }

    const items: AdminStaffUserDto[] = staffRows.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      roles: rolesMap.get(u.id) ?? [],
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return {
      items,
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Creates a new staff user with privileged operational roles.
   * Strictly guarded by SuperAdmin.
   */
  async createStaff(creatorId: string, input: CreateStaffUserInput): Promise<AdminStaffUserDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const email = input.email.trim().toLowerCase();

    // 1. Check existing user
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    // 2. Hash password with Argon2id
    const passwordHash = await this.passwordService.hash(input.password);

    // 3. Insert user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();

    if (!newUser) {
      throw new BadRequestException('Failed to create staff user');
    }

    // 4. Resolve role
    let [roleRow] = await db
      .select({ id: schema.roles.id, name: schema.roles.name })
      .from(schema.roles)
      .where(eq(schema.roles.name, input.role))
      .limit(1);

    if (!roleRow) {
      const [createdRole] = await db
        .insert(schema.roles)
        .values({
          name: input.role,
          description: `Platform operational staff role: ${input.role}`,
        })
        .returning();
      roleRow = createdRole!;
    }

    // 5. Assign role
    await db.insert(schema.userRoles).values({
      userId: newUser.id,
      roleId: roleRow.id,
    });

    // 6. Record immutable audit entry
    await this.auditService.logEvent({
      actorId: creatorId,
      actorRole: 'SUPER_ADMIN',
      action: 'CREATE_STAFF_USER',
      resourceType: 'STAFF_USER',
      resourceId: newUser.id,
      afterState: {
        email: newUser.email,
        role: input.role,
        status: newUser.status,
      },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      status: newUser.status,
      roles: [input.role],
      mfaEnabled: newUser.mfaEnabled,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString(),
    };
  }

  /**
   * Updates staff user status (e.g. SUSPENDED, DEACTIVATED, ACTIVE).
   * Prevents self-deactivation and preserves audit trail.
   */
  async updateStaffStatus(
    updaterId: string,
    targetUserId: string,
    input: UpdateStaffStatusInput,
  ): Promise<AdminStaffUserDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    if (updaterId === targetUserId) {
      throw new BadRequestException(
        'Super administrators cannot deactivate or suspend their own account',
      );
    }

    const [targetUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw new NotFoundException(`Staff user ${targetUserId} not found`);
    }

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, targetUserId))
      .returning();

    // Fetch user roles
    const userRoleRows = await db
      .select({ roleName: schema.roles.name })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, targetUserId));

    const roles = userRoleRows.map((r) => r.roleName);

    // Record immutable audit entry
    await this.auditService.logEvent({
      actorId: updaterId,
      actorRole: 'SUPER_ADMIN',
      action: 'UPDATE_STAFF_STATUS',
      resourceType: 'STAFF_USER',
      resourceId: targetUserId,
      beforeState: { status: targetUser.status },
      afterState: { status: input.status },
      metadata: { reason: input.reason },
    });

    return {
      id: updatedUser!.id,
      email: updatedUser!.email,
      firstName: updatedUser!.firstName,
      lastName: updatedUser!.lastName,
      status: updatedUser!.status,
      roles,
      mfaEnabled: updatedUser!.mfaEnabled,
      createdAt: updatedUser!.createdAt.toISOString(),
      updatedAt: updatedUser!.updatedAt.toISOString(),
    };
  }
}
