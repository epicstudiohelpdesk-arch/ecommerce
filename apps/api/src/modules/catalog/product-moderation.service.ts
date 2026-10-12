import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, desc, and, count } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { AdminModerateProductInput, PaginationQuery } from '@repo/validation';
import type { ProductModerationDecisionDto, ProductSummaryDto } from '@repo/api-contracts';

@Injectable()
export class ProductModerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lists products awaiting quality and authenticity moderation (PENDING_REVIEW).
   */
  async listPending(query: PaginationQuery): Promise<{
    items: (ProductSummaryDto & {
      sellerName: string;
      shopName: string | null;
      submittedAt: string | null;
    })[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const condition = eq(this.databaseService.schema.products.moderationStatus, 'PENDING_REVIEW');

    const [countResult] = await this.databaseService.db
      .select({ total: count() })
      .from(this.databaseService.schema.products)
      .where(condition);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        sellerId: this.databaseService.schema.products.sellerId,
        title: this.databaseService.schema.products.title,
        slug: this.databaseService.schema.products.slug,
        productType: this.databaseService.schema.products.productType,
        basePriceMinor: this.databaseService.schema.products.basePriceMinor,
        currency: this.databaseService.schema.products.currency,
        moderationStatus: this.databaseService.schema.products.moderationStatus,
        isActive: this.databaseService.schema.products.isActive,
        createdAt: this.databaseService.schema.products.createdAt,
        submittedAt: this.databaseService.schema.products.submittedAt,
        publishedAt: this.databaseService.schema.products.publishedAt,
        categoryId: this.databaseService.schema.categories.id,
        categoryName: this.databaseService.schema.categories.name,
        categorySlug: this.databaseService.schema.categories.slug,
        sellerLegalName: this.databaseService.schema.sellerProfiles.legalName,
        shopName: this.databaseService.schema.shops.name,
      })
      .from(this.databaseService.schema.products)
      .innerJoin(
        this.databaseService.schema.categories,
        eq(
          this.databaseService.schema.products.categoryId,
          this.databaseService.schema.categories.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.sellerProfiles,
        eq(
          this.databaseService.schema.products.sellerId,
          this.databaseService.schema.sellerProfiles.id,
        ),
      )
      .leftJoin(
        this.databaseService.schema.shops,
        eq(
          this.databaseService.schema.sellerProfiles.id,
          this.databaseService.schema.shops.sellerId,
        ),
      )
      .where(condition)
      .orderBy(desc(this.databaseService.schema.products.submittedAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      title: r.title,
      slug: r.slug,
      productType: r.productType,
      basePriceMinor: r.basePriceMinor,
      currency: r.currency,
      category: {
        id: r.categoryId,
        name: r.categoryName,
        slug: r.categorySlug,
      },
      primaryImageUrl: null,
      moderationStatus: r.moderationStatus,
      isActive: r.isActive,
      totalStock: 0,
      createdAt: r.createdAt.toISOString(),
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      sellerName: r.sellerLegalName,
      shopName: r.shopName,
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
   * Retrieves full product details and moderation history for administrative review.
   */
  async getProductForModeration(productId: string) {
    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, product.sellerId))
      .limit(1);

    const [shop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, product.sellerId))
      .limit(1);

    const [category] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .where(eq(this.databaseService.schema.categories.id, product.categoryId))
      .limit(1);

    const media = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productMedia)
      .where(eq(this.databaseService.schema.productMedia.productId, productId))
      .orderBy(this.databaseService.schema.productMedia.displayOrder);

    const variants = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productVariants)
      .where(eq(this.databaseService.schema.productVariants.productId, productId));

    const history = await this.databaseService.db
      .select({
        id: this.databaseService.schema.moderationRecords.id,
        action: this.databaseService.schema.moderationRecords.action,
        reasonCode: this.databaseService.schema.moderationRecords.reasonCode,
        notes: this.databaseService.schema.moderationRecords.notes,
        moderatorId: this.databaseService.schema.moderationRecords.moderatorId,
        createdAt: this.databaseService.schema.moderationRecords.createdAt,
      })
      .from(this.databaseService.schema.moderationRecords)
      .where(eq(this.databaseService.schema.moderationRecords.productId, productId))
      .orderBy(desc(this.databaseService.schema.moderationRecords.createdAt));

    return {
      product: {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        submittedAt: product.submittedAt?.toISOString() ?? null,
        publishedAt: product.publishedAt?.toISOString() ?? null,
      },
      category,
      seller,
      shop,
      media: media.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      variants: variants.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
      moderationHistory: history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Applies an administrative moderation decision (APPROVED -> PUBLISHED, REJECTED, SUSPENDED)
   * with strict segregation-of-duties enforcement and immutable audit recording.
   */
  async moderateProduct(
    productId: string,
    moderatorId: string,
    moderatorRole: string,
    input: AdminModerateProductInput,
  ): Promise<ProductModerationDecisionDto> {
    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.id, product.sellerId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException(`Seller profile for product ${productId} not found`);
    }

    // Segregation of Duties: A moderator CANNOT moderate listings from their own seller account
    if (seller.userId === moderatorId) {
      throw new BadRequestException(
        'Moderators cannot approve or moderate products from their own seller profile (segregation of duties violated)',
      );
    }

    // Status validation
    if (input.decision === 'APPROVED') {
      if (product.moderationStatus !== 'PENDING_REVIEW') {
        throw new BadRequestException(
          `Cannot approve listing with status ${product.moderationStatus}; must be in PENDING_REVIEW`,
        );
      }
    } else if (input.decision === 'REJECTED') {
      if (product.moderationStatus !== 'PENDING_REVIEW') {
        throw new BadRequestException(
          `Cannot reject listing with status ${product.moderationStatus}; must be in PENDING_REVIEW`,
        );
      }
    } else if (input.decision === 'SUSPENDED') {
      if (
        product.moderationStatus !== 'PUBLISHED' &&
        product.moderationStatus !== 'APPROVED' &&
        product.moderationStatus !== 'PENDING_REVIEW'
      ) {
        throw new BadRequestException(
          `Cannot suspend listing with status ${product.moderationStatus}`,
        );
      }
    }

    const now = new Date();
    const newModerationStatus =
      input.decision === 'APPROVED'
        ? 'PUBLISHED'
        : input.decision === 'REJECTED'
          ? 'REJECTED'
          : 'SUSPENDED';

    const isActive = input.decision === 'APPROVED';

    return await this.databaseService.db.transaction(async (tx) => {
      // 1. Update product table
      await tx
        .update(this.databaseService.schema.products)
        .set({
          moderationStatus: newModerationStatus,
          isActive,
          rejectionReason: input.decision === 'APPROVED' ? null : input.notes || input.reasonCode,
          publishedAt: input.decision === 'APPROVED' ? now : product.publishedAt,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.products.id, productId));

      // 2. Insert moderation record
      await tx.insert(this.databaseService.schema.moderationRecords).values({
        productId,
        moderatorId,
        action: input.decision,
        reasonCode: input.reasonCode,
        notes: input.notes ?? null,
        createdAt: now,
      });

      // 3. Log immutable audit entry
      await this.auditService.logEvent({
        actorId: moderatorId,
        actorRole: moderatorRole,
        action: `PRODUCT_MODERATED_${input.decision}`,
        resourceType: 'PRODUCT',
        resourceId: productId,
        metadata: {
          previousStatus: product.moderationStatus,
          newStatus: newModerationStatus,
          reasonCode: input.reasonCode,
          notes: input.notes ?? null,
        },
      });

      return {
        productId,
        decision: input.decision,
        moderationStatus: newModerationStatus,
        reasonCode: input.reasonCode,
        notes: input.notes ?? null,
        moderatedAt: now.toISOString(),
      };
    });
  }
}
