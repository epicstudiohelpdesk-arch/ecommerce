import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, and, desc, sql, or, ilike, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type {
  CreateSupportTicketInput,
  SupportTicketQuery,
  CreateTicketMessageInput,
  UpdateTicketStatusInput,
  TicketStatus,
} from '@repo/validation';
import type {
  SupportTicketListItemDto,
  SupportTicketDetailDto,
  SupportTicketMessageDto,
  PaginatedSupportTicketsDto,
} from '@repo/api-contracts';

const INTERNAL_ROLES = [
  'SUPER_ADMIN',
  'MARKETPLACE_MANAGER',
  'CUSTOMER_SUPPORT',
  'TRUST_SAFETY',
  'FINANCE_CONTROLLER',
  'READ_ONLY_ANALYST',
];

@Injectable()
export class SupportCasesService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private isInternalStaff(role: string): boolean {
    return INTERNAL_ROLES.includes(role);
  }

  /**
   * Creates a new support ticket and logs the initial customer/seller message.
   */
  async createTicket(
    creatorId: string,
    role: string,
    input: CreateSupportTicketInput,
  ): Promise<SupportTicketDetailDto> {
    // 1. Reference validations with tenant security checks
    if (input.orderId) {
      const [order] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.customerOrders)
        .where(eq(this.databaseService.schema.customerOrders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Order with ID ${input.orderId} not found`);
      }

      // Customer cannot attach another customer's order to a case
      if (role === 'CUSTOMER' && order.customerId !== creatorId) {
        throw new ForbiddenException('Cannot attach an order placed by another customer');
      }
    }

    if (input.subOrderId) {
      const [subOrder] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.subOrders)
        .where(eq(this.databaseService.schema.subOrders.id, input.subOrderId))
        .limit(1);

      if (!subOrder) {
        throw new NotFoundException(`Sub-order with ID ${input.subOrderId} not found`);
      }

      // If seller creates case, must own the sub-order
      if (role === 'SELLER') {
        const [sellerProfile] = await this.databaseService.db
          .select()
          .from(this.databaseService.schema.sellerProfiles)
          .where(eq(this.databaseService.schema.sellerProfiles.userId, creatorId))
          .limit(1);

        if (!sellerProfile || subOrder.sellerId !== sellerProfile.id) {
          throw new ForbiddenException('Cannot attach a sub-order belonging to another artisan');
        }
      }
    }

    if (input.productId) {
      const [product] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.products)
        .where(eq(this.databaseService.schema.products.id, input.productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${input.productId} not found`);
      }
    }

    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [ticket] = await this.databaseService.db
      .insert(this.databaseService.schema.supportTickets)
      .values({
        ticketNumber,
        creatorId,
        category: input.category,
        subject: input.subject,
        description: input.description,
        status: 'OPEN',
        priority: input.priority ?? 'MEDIUM',
        orderId: input.orderId ?? null,
        subOrderId: input.subOrderId ?? null,
        productId: input.productId ?? null,
        escalated: false,
      })
      .returning();

    if (!ticket) {
      throw new BadRequestException('Failed to create support ticket');
    }

    // Insert initial message
    await this.databaseService.db.insert(this.databaseService.schema.supportTicketMessages).values({
      ticketId: ticket.id,
      senderId: creatorId,
      senderRole: role,
      message: input.description,
      isInternal: false,
      attachments: [],
    });

    await this.auditService.logEvent({
      actorId: creatorId,
      actorRole: role,
      action: 'SUPPORT_TICKET_CREATED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticket.id,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        subject: ticket.subject,
      },
    });

    return this.getTicket(ticket.id, creatorId, role);
  }

  /**
   * Retrieves a paginated list of support tickets with strict tenant isolation.
   */
  async listTickets(
    actorId: string,
    role: string,
    query: SupportTicketQuery,
  ): Promise<PaginatedSupportTicketsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Tenancy isolation: Customers only see their own tickets
    if (role === 'CUSTOMER') {
      conditions.push(eq(this.databaseService.schema.supportTickets.creatorId, actorId));
    } else if (role === 'SELLER') {
      // Sellers see tickets they created OR tickets referencing their sub-orders
      const [sellerProfile] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.sellerProfiles)
        .where(eq(this.databaseService.schema.sellerProfiles.userId, actorId))
        .limit(1);

      if (sellerProfile) {
        // Find subOrderIds for this seller
        const sellerSubOrders = await this.databaseService.db
          .select({ id: this.databaseService.schema.subOrders.id })
          .from(this.databaseService.schema.subOrders)
          .where(eq(this.databaseService.schema.subOrders.sellerId, sellerProfile.id));

        const subOrderIds = sellerSubOrders.map((s) => s.id);

        if (subOrderIds.length > 0) {
          conditions.push(
            or(
              eq(this.databaseService.schema.supportTickets.creatorId, actorId),
              inArray(this.databaseService.schema.supportTickets.subOrderId, subOrderIds),
            ),
          );
        } else {
          conditions.push(eq(this.databaseService.schema.supportTickets.creatorId, actorId));
        }
      } else {
        conditions.push(eq(this.databaseService.schema.supportTickets.creatorId, actorId));
      }
    }

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.supportTickets.status, query.status));
    }

    if (query.category) {
      conditions.push(eq(this.databaseService.schema.supportTickets.category, query.category));
    }

    if (query.priority) {
      conditions.push(eq(this.databaseService.schema.supportTickets.priority, query.priority));
    }

    if (query.unassigned) {
      conditions.push(sql`${this.databaseService.schema.supportTickets.assignedAgentId} IS NULL`);
    }

    if (query.assignedAgentId) {
      conditions.push(
        eq(this.databaseService.schema.supportTickets.assignedAgentId, query.assignedAgentId),
      );
    }

    if (query.search) {
      conditions.push(
        or(
          ilike(this.databaseService.schema.supportTickets.subject, `%${query.search}%`),
          ilike(this.databaseService.schema.supportTickets.ticketNumber, `%${query.search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)` })
      .from(this.databaseService.schema.supportTickets)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.supportTickets.id,
        ticketNumber: this.databaseService.schema.supportTickets.ticketNumber,
        category: this.databaseService.schema.supportTickets.category,
        subject: this.databaseService.schema.supportTickets.subject,
        status: this.databaseService.schema.supportTickets.status,
        priority: this.databaseService.schema.supportTickets.priority,
        creatorId: this.databaseService.schema.supportTickets.creatorId,
        creatorFirstName: this.databaseService.schema.users.firstName,
        creatorLastName: this.databaseService.schema.users.lastName,
        creatorEmail: this.databaseService.schema.users.email,
        assignedAgentId: this.databaseService.schema.supportTickets.assignedAgentId,
        orderId: this.databaseService.schema.supportTickets.orderId,
        createdAt: this.databaseService.schema.supportTickets.createdAt,
        updatedAt: this.databaseService.schema.supportTickets.updatedAt,
      })
      .from(this.databaseService.schema.supportTickets)
      .innerJoin(
        this.databaseService.schema.users,
        eq(
          this.databaseService.schema.supportTickets.creatorId,
          this.databaseService.schema.users.id,
        ),
      )
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.supportTickets.updatedAt))
      .limit(limit)
      .offset(offset);

    const tickets: SupportTicketListItemDto[] = rows.map((r) => ({
      id: r.id,
      ticketNumber: r.ticketNumber,
      category: r.category,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      creatorId: r.creatorId,
      creatorName: `${r.creatorFirstName} ${r.creatorLastName}`.trim(),
      creatorEmail: r.creatorEmail,
      assignedAgentId: r.assignedAgentId,
      assignedAgentName: null,
      orderNumber: null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single ticket details. Internal notes are strictly redacted for customers and sellers.
   */
  async getTicket(
    ticketId: string,
    actorId: string,
    role: string,
  ): Promise<SupportTicketDetailDto> {
    const [ticket] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.supportTickets.id,
        ticketNumber: this.databaseService.schema.supportTickets.ticketNumber,
        category: this.databaseService.schema.supportTickets.category,
        subject: this.databaseService.schema.supportTickets.subject,
        description: this.databaseService.schema.supportTickets.description,
        status: this.databaseService.schema.supportTickets.status,
        priority: this.databaseService.schema.supportTickets.priority,
        creatorId: this.databaseService.schema.supportTickets.creatorId,
        creatorFirstName: this.databaseService.schema.users.firstName,
        creatorLastName: this.databaseService.schema.users.lastName,
        creatorEmail: this.databaseService.schema.users.email,
        assignedAgentId: this.databaseService.schema.supportTickets.assignedAgentId,
        orderId: this.databaseService.schema.supportTickets.orderId,
        subOrderId: this.databaseService.schema.supportTickets.subOrderId,
        productId: this.databaseService.schema.supportTickets.productId,
        escalated: this.databaseService.schema.supportTickets.escalated,
        escalationReason: this.databaseService.schema.supportTickets.escalationReason,
        resolutionNotes: this.databaseService.schema.supportTickets.resolutionNotes,
        resolvedAt: this.databaseService.schema.supportTickets.resolvedAt,
        createdAt: this.databaseService.schema.supportTickets.createdAt,
        updatedAt: this.databaseService.schema.supportTickets.updatedAt,
      })
      .from(this.databaseService.schema.supportTickets)
      .innerJoin(
        this.databaseService.schema.users,
        eq(
          this.databaseService.schema.supportTickets.creatorId,
          this.databaseService.schema.users.id,
        ),
      )
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
    }

    const isStaff = this.isInternalStaff(role);

    // Tenancy isolation check
    if (!isStaff) {
      if (role === 'CUSTOMER' && ticket.creatorId !== actorId) {
        throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
      }
      if (role === 'SELLER') {
        let isAuthorized = ticket.creatorId === actorId;
        if (!isAuthorized && ticket.subOrderId) {
          const [sellerProfile] = await this.databaseService.db
            .select()
            .from(this.databaseService.schema.sellerProfiles)
            .where(eq(this.databaseService.schema.sellerProfiles.userId, actorId))
            .limit(1);

          if (sellerProfile) {
            const [subOrder] = await this.databaseService.db
              .select()
              .from(this.databaseService.schema.subOrders)
              .where(
                and(
                  eq(this.databaseService.schema.subOrders.id, ticket.subOrderId),
                  eq(this.databaseService.schema.subOrders.sellerId, sellerProfile.id),
                ),
              )
              .limit(1);
            if (subOrder) isAuthorized = true;
          }
        }
        if (!isAuthorized) {
          throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
        }
      }
    }

    // Retrieve messages (filtering out internal notes for non-staff)
    const messageConditions = [
      eq(this.databaseService.schema.supportTicketMessages.ticketId, ticketId),
    ];
    if (!isStaff) {
      messageConditions.push(
        eq(this.databaseService.schema.supportTicketMessages.isInternal, false),
      );
    }

    const messages = await this.databaseService.db
      .select({
        id: this.databaseService.schema.supportTicketMessages.id,
        ticketId: this.databaseService.schema.supportTicketMessages.ticketId,
        senderId: this.databaseService.schema.supportTicketMessages.senderId,
        senderFirstName: this.databaseService.schema.users.firstName,
        senderLastName: this.databaseService.schema.users.lastName,
        senderRole: this.databaseService.schema.supportTicketMessages.senderRole,
        message: this.databaseService.schema.supportTicketMessages.message,
        isInternal: this.databaseService.schema.supportTicketMessages.isInternal,
        attachments: this.databaseService.schema.supportTicketMessages.attachments,
        createdAt: this.databaseService.schema.supportTicketMessages.createdAt,
      })
      .from(this.databaseService.schema.supportTicketMessages)
      .innerJoin(
        this.databaseService.schema.users,
        eq(
          this.databaseService.schema.supportTicketMessages.senderId,
          this.databaseService.schema.users.id,
        ),
      )
      .where(and(...messageConditions))
      .orderBy(this.databaseService.schema.supportTicketMessages.createdAt);

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      creatorId: ticket.creatorId,
      creatorName: `${ticket.creatorFirstName} ${ticket.creatorLastName}`.trim(),
      creatorEmail: ticket.creatorEmail,
      assignedAgentId: ticket.assignedAgentId,
      assignedAgentName: null,
      orderId: ticket.orderId,
      orderNumber: null,
      subOrderId: ticket.subOrderId,
      subOrderNumber: null,
      productId: ticket.productId,
      productTitle: null,
      escalated: ticket.escalated,
      escalationReason: ticket.escalationReason,
      resolutionNotes: ticket.resolutionNotes,
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        ticketId: m.ticketId,
        senderId: m.senderId,
        senderName: `${m.senderFirstName} ${m.senderLastName}`.trim(),
        senderRole: m.senderRole,
        message: m.message,
        isInternal: m.isInternal,
        attachments: (m.attachments as Record<string, unknown>[]) ?? [],
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Adds a message or internal note to an existing ticket.
   */
  async addMessage(
    ticketId: string,
    senderId: string,
    senderRole: string,
    input: CreateTicketMessageInput,
  ): Promise<SupportTicketMessageDto> {
    const isStaff = this.isInternalStaff(senderRole);

    // Confidentiality guard: Customers and sellers can NEVER post internal notes
    if (input.isInternal && !isStaff) {
      throw new ForbiddenException(
        'Only internal platform staff are permitted to post internal notes',
      );
    }

    // Verify ticket exists and sender has access
    const ticket = await this.getTicket(ticketId, senderId, senderRole);

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Cannot reply to a closed support ticket');
    }

    const [message] = await this.databaseService.db
      .insert(this.databaseService.schema.supportTicketMessages)
      .values({
        ticketId,
        senderId,
        senderRole,
        message: input.message,
        isInternal: input.isInternal ?? false,
        attachments: input.attachments ?? [],
      })
      .returning();

    if (!message) {
      throw new BadRequestException('Failed to add message to ticket');
    }

    // Update ticket updatedAt and advance status if waiting for user
    const updatePayload: { updatedAt: Date; status?: TicketStatus } = { updatedAt: new Date() };
    if (!isStaff && ticket.status === 'WAITING_FOR_USER') {
      updatePayload.status = 'IN_PROGRESS';
    }

    await this.databaseService.db
      .update(this.databaseService.schema.supportTickets)
      .set(updatePayload)
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId));

    await this.auditService.logEvent({
      actorId: senderId,
      actorRole: senderRole,
      action: input.isInternal ? 'SUPPORT_INTERNAL_NOTE_ADDED' : 'SUPPORT_MESSAGE_ADDED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticketId,
      metadata: {
        isInternal: input.isInternal,
      },
    });

    const [sender] = await this.databaseService.db
      .select({
        firstName: this.databaseService.schema.users.firstName,
        lastName: this.databaseService.schema.users.lastName,
      })
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, senderId))
      .limit(1);

    return {
      id: message.id,
      ticketId: message.ticketId,
      senderId: message.senderId,
      senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'User',
      senderRole: message.senderRole,
      message: message.message,
      isInternal: message.isInternal,
      attachments: (message.attachments as Record<string, unknown>[]) ?? [],
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Updates ticket status with server-authoritative state machine transitions.
   */
  async updateStatus(
    ticketId: string,
    staffId: string,
    staffRole: string,
    input: UpdateTicketStatusInput,
  ): Promise<SupportTicketDetailDto> {
    if (!this.isInternalStaff(staffRole)) {
      throw new ForbiddenException('Only internal platform staff can modify support ticket status');
    }

    const [ticket] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.supportTickets)
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
    }

    // State machine validation
    const currentStatus = ticket.status;
    const newStatus = input.status;

    if (currentStatus === 'CLOSED' && staffRole !== 'SUPER_ADMIN') {
      throw new BadRequestException('Closed tickets cannot be modified');
    }

    const now = new Date();
    const updatePayload: {
      status: TicketStatus;
      resolutionNotes?: string | null;
      resolvedAt?: Date | null;
      updatedAt: Date;
    } = {
      status: newStatus,
      updatedAt: now,
    };

    if (newStatus === 'RESOLVED') {
      updatePayload.resolvedAt = now;
      updatePayload.resolutionNotes = input.resolutionNotes ?? 'Ticket resolved by support agent';
    } else if (newStatus === 'CLOSED') {
      if (!ticket.resolvedAt) {
        updatePayload.resolvedAt = now;
      }
    }

    await this.databaseService.db
      .update(this.databaseService.schema.supportTickets)
      .set(updatePayload)
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId));

    await this.auditService.logEvent({
      actorId: staffId,
      actorRole: staffRole,
      action: 'SUPPORT_TICKET_STATUS_UPDATED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticketId,
      metadata: {
        fromStatus: currentStatus,
        toStatus: newStatus,
        resolutionNotes: input.resolutionNotes ?? null,
      },
    });

    return this.getTicket(ticketId, staffId, staffRole);
  }

  /**
   * Assigns a ticket to a staff member.
   */
  async assignTicket(
    ticketId: string,
    staffId: string,
    staffRole: string,
    agentId: string,
  ): Promise<SupportTicketDetailDto> {
    if (!this.isInternalStaff(staffRole)) {
      throw new ForbiddenException('Only internal platform staff can assign tickets');
    }

    const [ticket] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.supportTickets)
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
    }

    const [agent] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, agentId))
      .limit(1);

    if (!agent) {
      throw new NotFoundException(`Staff agent with ID ${agentId} not found`);
    }

    const now = new Date();
    const newStatus = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;

    await this.databaseService.db
      .update(this.databaseService.schema.supportTickets)
      .set({
        assignedAgentId: agentId,
        status: newStatus,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId));

    await this.auditService.logEvent({
      actorId: staffId,
      actorRole: staffRole,
      action: 'SUPPORT_TICKET_ASSIGNED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticketId,
      metadata: {
        assignedAgentId: agentId,
      },
    });

    return this.getTicket(ticketId, staffId, staffRole);
  }

  /**
   * Escalates a ticket to URGENT priority.
   */
  async escalateTicket(
    ticketId: string,
    staffId: string,
    staffRole: string,
    reason: string,
  ): Promise<SupportTicketDetailDto> {
    if (!this.isInternalStaff(staffRole)) {
      throw new ForbiddenException('Only internal platform staff can escalate tickets');
    }

    const [ticket] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.supportTickets)
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.supportTickets)
      .set({
        escalated: true,
        escalationReason: reason,
        priority: 'URGENT',
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.supportTickets.id, ticketId));

    // Record internal note describing escalation
    await this.databaseService.db.insert(this.databaseService.schema.supportTicketMessages).values({
      ticketId,
      senderId: staffId,
      senderRole: staffRole,
      message: `[ESCALATION NOTE] Ticket escalated to URGENT. Reason: ${reason}`,
      isInternal: true,
      attachments: [],
    });

    await this.auditService.logEvent({
      actorId: staffId,
      actorRole: staffRole,
      action: 'SUPPORT_TICKET_ESCALATED',
      resourceType: 'SUPPORT_TICKET',
      resourceId: ticketId,
      metadata: {
        reason,
      },
    });

    return this.getTicket(ticketId, staffId, staffRole);
  }
}
