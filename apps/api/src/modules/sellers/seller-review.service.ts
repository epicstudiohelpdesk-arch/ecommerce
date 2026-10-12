import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, or, ilike, count, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SellerDocumentsStorageService } from './seller-documents-storage.service';
import type {
  ListSellerApplicationsQuery,
  AdminReviewSellerInput,
  AdminSuspendSellerInput,
} from '@repo/validation';
import type { SellerApplicationSummary, SellerApplicationDetail } from '@repo/api-contracts';

@Injectable()
export class SellerReviewService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly storageService: SellerDocumentsStorageService,
  ) {}

  /**
   * Lists seller applications with filters, search, and pagination.
   */
  async listApplications(query: ListSellerApplicationsQuery): Promise<{
    items: SellerApplicationSummary[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(
        eq(this.databaseService.schema.sellerProfiles.verificationStatus, query.status),
      );
    }

    if (query.businessType) {
      conditions.push(
        eq(this.databaseService.schema.sellerProfiles.businessType, query.businessType),
      );
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(this.databaseService.schema.sellerProfiles.legalName, searchPattern),
          ilike(this.databaseService.schema.shops.name, searchPattern),
          ilike(this.databaseService.schema.shops.slug, searchPattern),
          ilike(this.databaseService.schema.users.email, searchPattern),
          ilike(this.databaseService.schema.users.firstName, searchPattern),
          ilike(this.databaseService.schema.users.lastName, searchPattern),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [countResult] = await this.databaseService.db
      .select({ total: count() })
      .from(this.databaseService.schema.sellerProfiles)
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.sellerProfiles.userId, this.databaseService.schema.users.id),
      )
      .leftJoin(
        this.databaseService.schema.shops,
        eq(
          this.databaseService.schema.sellerProfiles.id,
          this.databaseService.schema.shops.sellerId,
        ),
      )
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    // Records query
    const rows = await this.databaseService.db
      .select({
        sellerId: this.databaseService.schema.sellerProfiles.id,
        userId: this.databaseService.schema.users.id,
        userEmail: this.databaseService.schema.users.email,
        userFirstName: this.databaseService.schema.users.firstName,
        userLastName: this.databaseService.schema.users.lastName,
        legalName: this.databaseService.schema.sellerProfiles.legalName,
        businessType: this.databaseService.schema.sellerProfiles.businessType,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
        submittedAt: this.databaseService.schema.sellerProfiles.submittedAt,
        createdAt: this.databaseService.schema.sellerProfiles.createdAt,
        shopName: this.databaseService.schema.shops.name,
        shopSlug: this.databaseService.schema.shops.slug,
      })
      .from(this.databaseService.schema.sellerProfiles)
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.sellerProfiles.userId, this.databaseService.schema.users.id),
      )
      .leftJoin(
        this.databaseService.schema.shops,
        eq(
          this.databaseService.schema.sellerProfiles.id,
          this.databaseService.schema.shops.sellerId,
        ),
      )
      .where(whereClause)
      .orderBy(
        desc(this.databaseService.schema.sellerProfiles.submittedAt),
        desc(this.databaseService.schema.sellerProfiles.createdAt),
      )
      .limit(limit)
      .offset(offset);

    // Get document counts for the fetched sellers
    const sellerIds = rows.map((r) => r.sellerId);
    const docCountsMap = new Map<string, number>();

    if (sellerIds.length > 0) {
      const docCounts = await this.databaseService.db
        .select({
          sellerId: this.databaseService.schema.sellerDocuments.sellerId,
          docCount: count(),
        })
        .from(this.databaseService.schema.sellerDocuments)
        .groupBy(this.databaseService.schema.sellerDocuments.sellerId);

      for (const item of docCounts) {
        docCountsMap.set(item.sellerId, Number(item.docCount));
      }
    }

    const items: SellerApplicationSummary[] = rows.map((r) => ({
      sellerId: r.sellerId,
      userId: r.userId,
      userEmail: r.userEmail,
      userFullName: `${r.userFirstName} ${r.userLastName}`.trim(),
      legalName: r.legalName,
      businessType: r.businessType,
      shopName: r.shopName ?? 'Unnamed Shop Draft',
      shopSlug: r.shopSlug ?? '',
      verificationStatus: r.verificationStatus,
      documentCount: docCountsMap.get(r.sellerId) ?? 0,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves full application details for an administrative reviewer, including 5-minute pre-signed download URLs.
   */
  async getApplicationDetail(
    sellerId: string,
    reviewerId: string,
  ): Promise<SellerApplicationDetail> {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`Seller application with ID ${sellerId} not found`);
    }

    const [user] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.users.id,
        email: this.databaseService.schema.users.email,
        firstName: this.databaseService.schema.users.firstName,
        lastName: this.databaseService.schema.users.lastName,
      })
      .from(this.databaseService.schema.users)
      .where(eq(this.databaseService.schema.users.id, seller.userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Associated user account not found');
    }

    const [shop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
      .limit(1);

    const [pickupAddress] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.pickupAddresses)
      .where(eq(this.databaseService.schema.pickupAddresses.sellerId, seller.id))
      .limit(1);

    const documents = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerDocuments)
      .where(eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id));

    return {
      sellerId: seller.id,
      userId: user.id,
      userEmail: user.email,
      userFullName: `${user.firstName} ${user.lastName}`.trim(),
      legalName: seller.legalName,
      businessType: seller.businessType,
      taxId: seller.taxId,
      verificationStatus: seller.verificationStatus,
      rejectionReason: seller.rejectionReason,
      submittedAt: seller.submittedAt ? seller.submittedAt.toISOString() : null,
      verifiedAt: seller.verifiedAt ? seller.verifiedAt.toISOString() : null,
      termsAcceptedVersion: seller.termsAcceptedVersion,
      termsAcceptedAt: seller.termsAcceptedAt ? seller.termsAcceptedAt.toISOString() : null,
      shop: shop
        ? {
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            description: shop.description,
            craftStory: shop.craftStory,
            logoUrl: shop.logoUrl,
          }
        : null,
      pickupAddress: pickupAddress
        ? {
            contactName: pickupAddress.contactName,
            phone: pickupAddress.phone,
            addressLine1: pickupAddress.addressLine1,
            addressLine2: pickupAddress.addressLine2,
            city: pickupAddress.city,
            state: pickupAddress.state,
            postalCode: pickupAddress.postalCode,
            country: pickupAddress.country,
          }
        : null,
      documents: documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileSizeBytes: doc.fileSizeBytes,
        mimeType: doc.mimeType,
        status: doc.status,
        reviewNotes: doc.reviewNotes,
        downloadUrl: this.storageService.generateAuthorizedDownloadUrl(doc.storagePath, reviewerId),
        createdAt: doc.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Executes a formal review decision (APPROVED, REJECTED, ACTION_REQUIRED) with segregation-of-duties checks.
   */
  async reviewApplication(
    sellerId: string,
    reviewerId: string,
    reviewerRole: string,
    input: AdminReviewSellerInput,
  ) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`Seller application with ID ${sellerId} not found`);
    }

    // Segregation of Duties: Reviewers cannot approve or review their own seller applications
    if (seller.userId === reviewerId) {
      throw new BadRequestException(
        'Reviewers cannot approve or review their own seller applications (segregation of duties violated)',
      );
    }

    // Only applications submitted for review can be processed
    if (seller.verificationStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Cannot review application with status ${seller.verificationStatus}; must be in PENDING_REVIEW`,
      );
    }

    const now = new Date();

    if (input.decision === 'APPROVED') {
      // 1. Update seller profile to VERIFIED
      await this.databaseService.db
        .update(this.databaseService.schema.sellerProfiles)
        .set({
          verificationStatus: 'VERIFIED',
          verifiedAt: now,
          rejectionReason: null,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id));

      // 2. Mark pending documents as VERIFIED
      await this.databaseService.db
        .update(this.databaseService.schema.sellerDocuments)
        .set({
          status: 'VERIFIED',
          updatedAt: now,
        })
        .where(
          and(
            eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id),
            eq(this.databaseService.schema.sellerDocuments.status, 'PENDING'),
          ),
        );

      // 3. Promote user to APPROVED_SELLER role
      let [sellerRole] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.roles)
        .where(eq(this.databaseService.schema.roles.name, 'APPROVED_SELLER'))
        .limit(1);

      if (!sellerRole) {
        [sellerRole] = await this.databaseService.db
          .insert(this.databaseService.schema.roles)
          .values({
            name: 'APPROVED_SELLER',
            description:
              'Verified artisan seller authorized to publish products and fulfill orders',
          })
          .returning();
      }

      if (sellerRole) {
        await this.databaseService.db
          .insert(this.databaseService.schema.userRoles)
          .values({
            userId: seller.userId,
            roleId: sellerRole.id,
            sellerId: seller.id,
          })
          .onConflictDoNothing();
      }

      // 4. Audit Log
      await this.auditService.logEvent({
        actorId: reviewerId,
        actorRole: reviewerRole,
        action: 'SELLER_APPLICATION_APPROVED',
        resourceType: 'SELLER',
        resourceId: seller.id,
        metadata: {
          decision: 'APPROVED',
          reasonNotes: input.reasonNotes ?? null,
        },
      });

      return {
        sellerId: seller.id,
        decision: 'APPROVED',
        verificationStatus: 'VERIFIED',
        verifiedAt: now.toISOString(),
      };
    }

    if (input.decision === 'REJECTED') {
      await this.databaseService.db
        .update(this.databaseService.schema.sellerProfiles)
        .set({
          verificationStatus: 'REJECTED',
          rejectionReason: input.reasonNotes,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id));

      await this.auditService.logEvent({
        actorId: reviewerId,
        actorRole: reviewerRole,
        action: 'SELLER_APPLICATION_REJECTED',
        resourceType: 'SELLER',
        resourceId: seller.id,
        metadata: {
          decision: 'REJECTED',
          reasonNotes: input.reasonNotes,
        },
      });

      return {
        sellerId: seller.id,
        decision: 'REJECTED',
        verificationStatus: 'REJECTED',
        reasonNotes: input.reasonNotes,
      };
    }

    if (input.decision === 'ACTION_REQUIRED') {
      // Revert status to DRAFT so applicant can address requested changes and resubmit
      await this.databaseService.db
        .update(this.databaseService.schema.sellerProfiles)
        .set({
          verificationStatus: 'DRAFT',
          rejectionReason: input.reasonNotes,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id));

      await this.auditService.logEvent({
        actorId: reviewerId,
        actorRole: reviewerRole,
        action: 'SELLER_APPLICATION_ACTION_REQUIRED',
        resourceType: 'SELLER',
        resourceId: seller.id,
        metadata: {
          decision: 'ACTION_REQUIRED',
          reasonNotes: input.reasonNotes,
        },
      });

      return {
        sellerId: seller.id,
        decision: 'ACTION_REQUIRED',
        verificationStatus: 'DRAFT',
        reasonNotes: input.reasonNotes,
      };
    }

    throw new BadRequestException(`Unsupported review decision: ${input.decision}`);
  }

  /**
   * Suspends a seller profile and immediately restricts marketplace operations.
   */
  async suspendSeller(
    sellerId: string,
    reviewerId: string,
    reviewerRole: string,
    input: AdminSuspendSellerInput,
  ) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`Seller with ID ${sellerId} not found`);
    }

    if (seller.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException('Seller is already suspended');
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.sellerProfiles)
      .set({
        verificationStatus: 'SUSPENDED',
        rejectionReason: input.reason,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id));

    await this.auditService.logEvent({
      actorId: reviewerId,
      actorRole: reviewerRole,
      action: 'SELLER_SUSPENDED',
      resourceType: 'SELLER',
      resourceId: seller.id,
      metadata: {
        reason: input.reason,
      },
    });

    return {
      sellerId: seller.id,
      verificationStatus: 'SUSPENDED',
      reason: input.reason,
    };
  }

  /**
   * Reinstates a previously suspended seller profile to VERIFIED status.
   */
  async reinstateSeller(sellerId: string, reviewerId: string, reviewerRole: string) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`Seller with ID ${sellerId} not found`);
    }

    if (seller.verificationStatus !== 'SUSPENDED') {
      throw new BadRequestException('Only suspended sellers can be reinstated');
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.sellerProfiles)
      .set({
        verificationStatus: 'VERIFIED',
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id));

    await this.auditService.logEvent({
      actorId: reviewerId,
      actorRole: reviewerRole,
      action: 'SELLER_REINSTATED',
      resourceType: 'SELLER',
      resourceId: seller.id,
    });

    return {
      sellerId: seller.id,
      verificationStatus: 'VERIFIED',
      message: 'Seller successfully reinstated',
    };
  }
}
