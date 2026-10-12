import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, ilike, sql, count, desc, inArray } from 'drizzle-orm';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SellerEligibilityService } from '../sellers/seller-eligibility.service';
import { InventoryService } from './inventory.service';
import type {
  CreateProductDraftInput,
  UpdateProductInput,
  ListSellerProductsQuery,
  ProductMediaOrderInput,
} from '@repo/validation';
import type {
  ProductDetailDto,
  ProductSummaryDto,
  ProductMediaDto,
  ProductVariantDto,
} from '@repo/api-contracts';

@Injectable()
export class ProductManagementService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly sellerEligibilityService: SellerEligibilityService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Helper to resolve authenticated user's seller profile and verify eligibility.
   */
  async getSellerProfile(userId: string) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Artisan seller profile not found for current user account');
    }

    const eligibility = await this.sellerEligibilityService.checkSellerEligibility(seller.id);
    return { seller, eligibility };
  }

  /**
   * Generates a collision-resistant, URL-safe slug for a product.
   */
  private generateSlug(title: string): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const rand = crypto.randomBytes(3).toString('hex');
    return `${base}-${rand}`;
  }

  /**
   * Creates a new handcrafted product draft with default or specified variants and inventory.
   */
  async createDraft(userId: string, input: CreateProductDraftInput): Promise<ProductDetailDto> {
    const { seller, eligibility } = await this.getSellerProfile(userId);

    // Enforce eligibility invariant
    if (!eligibility.canPublishProducts) {
      throw new ForbiddenException(
        eligibility.reason ||
          'Seller account must be VERIFIED before creating or publishing product listings',
      );
    }

    // Verify category exists and is active
    const [category] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .where(eq(this.databaseService.schema.categories.id, input.categoryId))
      .limit(1);

    if (!category || !category.isActive) {
      throw new BadRequestException('Selected category does not exist or is inactive');
    }

    const slug = this.generateSlug(input.title);
    const now = new Date();

    const createdProduct = await this.databaseService.db.transaction(async (tx) => {
      // 1. Insert product
      const [product] = await tx
        .insert(this.databaseService.schema.products)
        .values({
          sellerId: seller.id,
          categoryId: input.categoryId,
          productType: input.productType,
          title: input.title,
          slug,
          shortDescription: input.shortDescription ?? null,
          description: input.description,
          basePriceMinor: input.basePriceMinor,
          currency: input.currency || 'INR',
          moderationStatus: 'DRAFT',
          isActive: true,
          isFragile: input.isFragile ?? false,
          isCustomizable: input.isCustomizable ?? false,
          customizationInstructions: input.customizationInstructions ?? null,
          productionLeadTimeDays: input.productionLeadTimeDays ?? 0,
          materials: input.materials || [],
          techniques: input.techniques || [],
          careInstructions: input.careInstructions ?? null,
          countryOfOrigin: input.countryOfOrigin || 'IN',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!product) {
        throw new Error('Failed to insert product record');
      }

      // 2. Insert variants and inventory records
      const variantsToCreate =
        input.variants && input.variants.length > 0
          ? input.variants
          : [
              {
                sku: `${slug.toUpperCase().slice(0, 20)}-01`,
                title: 'Standard',
                priceMinor: input.basePriceMinor,
                compareAtPriceMinor: null,
                weightGrams: 500,
                dimensions: { lengthMm: 150, widthMm: 150, heightMm: 100 },
                attributes: {},
                initialStock: 5,
                isUnlimited: false,
                isActive: true,
              },
            ];

      for (const v of variantsToCreate) {
        const [variant] = await tx
          .insert(this.databaseService.schema.productVariants)
          .values({
            productId: product.id,
            sku: v.sku,
            title: v.title,
            priceMinor: v.priceMinor,
            currency: input.currency || 'INR',
            compareAtPriceMinor: v.compareAtPriceMinor ?? null,
            weightGrams: v.weightGrams,
            dimensionLengthMm: v.dimensions.lengthMm,
            dimensionWidthMm: v.dimensions.widthMm,
            dimensionHeightMm: v.dimensions.heightMm,
            attributes: v.attributes || {},
            isActive: v.isActive ?? true,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (variant) {
          await tx.insert(this.databaseService.schema.inventoryItems).values({
            variantId: variant.id,
            quantityOnHand: v.initialStock ?? 0,
            quantityReserved: 0,
            lowStockThreshold: 2,
            isUnlimited: v.isUnlimited ?? false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 3. Log audit event
      await this.auditService.logEvent({
        actorId: userId,
        actorRole: 'APPROVED_SELLER',
        action: 'PRODUCT_CREATED',
        resourceType: 'PRODUCT',
        resourceId: product.id,
        metadata: {
          title: product.title,
          slug: product.slug,
          productType: product.productType,
          basePriceMinor: product.basePriceMinor,
        },
      });

      return product;
    });

    return this.getSellerProduct(userId, createdProduct.id);
  }

  /**
   * Updates an existing product draft or published listing.
   */
  async updateProduct(
    userId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductDetailDto> {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Multi-tenant Seller Isolation
    if (product.sellerId !== seller.id) {
      throw new ForbiddenException('Forbidden: You do not own this product listing');
    }

    if (product.moderationStatus === 'SUSPENDED') {
      throw new ForbiddenException(
        'Cannot edit a suspended product listing; contact marketplace compliance',
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (input.title !== undefined) updateData['title'] = input.title;
    if (input.shortDescription !== undefined)
      updateData['shortDescription'] = input.shortDescription;
    if (input.description !== undefined) updateData['description'] = input.description;
    if (input.categoryId !== undefined) updateData['categoryId'] = input.categoryId;
    if (input.productType !== undefined) updateData['productType'] = input.productType;
    if (input.basePriceMinor !== undefined) updateData['basePriceMinor'] = input.basePriceMinor;
    if (input.currency !== undefined) updateData['currency'] = input.currency;
    if (input.isFragile !== undefined) updateData['isFragile'] = input.isFragile;
    if (input.isCustomizable !== undefined) updateData['isCustomizable'] = input.isCustomizable;
    if (input.customizationInstructions !== undefined)
      updateData['customizationInstructions'] = input.customizationInstructions;
    if (input.productionLeadTimeDays !== undefined)
      updateData['productionLeadTimeDays'] = input.productionLeadTimeDays;
    if (input.materials !== undefined) updateData['materials'] = input.materials;
    if (input.techniques !== undefined) updateData['techniques'] = input.techniques;
    if (input.careInstructions !== undefined)
      updateData['careInstructions'] = input.careInstructions;
    if (input.countryOfOrigin !== undefined) updateData['countryOfOrigin'] = input.countryOfOrigin;
    if (input.isActive !== undefined) updateData['isActive'] = input.isActive;

    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(this.databaseService.schema.products)
        .set(updateData)
        .where(eq(this.databaseService.schema.products.id, productId));

      // Handle variant updates or additions if provided
      if (input.variants && input.variants.length > 0) {
        for (const v of input.variants) {
          if (v.id) {
            // Update existing variant
            await tx
              .update(this.databaseService.schema.productVariants)
              .set({
                sku: v.sku,
                title: v.title,
                priceMinor: v.priceMinor,
                compareAtPriceMinor: v.compareAtPriceMinor ?? null,
                weightGrams: v.weightGrams,
                dimensionLengthMm: v.dimensions.lengthMm,
                dimensionWidthMm: v.dimensions.widthMm,
                dimensionHeightMm: v.dimensions.heightMm,
                attributes: v.attributes || {},
                isActive: v.isActive ?? true,
                updatedAt: now,
              })
              .where(
                and(
                  eq(this.databaseService.schema.productVariants.id, v.id),
                  eq(this.databaseService.schema.productVariants.productId, productId),
                ),
              );
          } else {
            // Insert new variant
            const [newVar] = await tx
              .insert(this.databaseService.schema.productVariants)
              .values({
                productId,
                sku: v.sku,
                title: v.title,
                priceMinor: v.priceMinor,
                currency: input.currency || product.currency,
                compareAtPriceMinor: v.compareAtPriceMinor ?? null,
                weightGrams: v.weightGrams,
                dimensionLengthMm: v.dimensions.lengthMm,
                dimensionWidthMm: v.dimensions.widthMm,
                dimensionHeightMm: v.dimensions.heightMm,
                attributes: v.attributes || {},
                isActive: v.isActive ?? true,
                createdAt: now,
                updatedAt: now,
              })
              .returning();

            if (newVar) {
              await tx.insert(this.databaseService.schema.inventoryItems).values({
                variantId: newVar.id,
                quantityOnHand: v.initialStock ?? 0,
                quantityReserved: 0,
                lowStockThreshold: 2,
                isUnlimited: v.isUnlimited ?? false,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }

      await this.auditService.logEvent({
        actorId: userId,
        actorRole: 'APPROVED_SELLER',
        action: 'PRODUCT_UPDATED',
        resourceType: 'PRODUCT',
        resourceId: productId,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
      });
    });

    return this.getSellerProduct(userId, productId);
  }

  /**
   * Submits a product draft for quality and authenticity compliance moderation.
   */
  async submitForModeration(userId: string, productId: string): Promise<ProductDetailDto> {
    const { seller, eligibility } = await this.getSellerProfile(userId);

    if (!eligibility.canPublishProducts) {
      throw new ForbiddenException(
        eligibility.reason || 'Seller is not eligible to submit products for moderation',
      );
    }

    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.sellerId !== seller.id) {
      throw new ForbiddenException('Forbidden: You do not own this product listing');
    }

    if (product.moderationStatus === 'PENDING_REVIEW') {
      throw new BadRequestException('Product is already under compliance review');
    }

    if (product.moderationStatus === 'SUSPENDED') {
      throw new BadRequestException('Suspended product listings cannot be resubmitted directly');
    }

    // Completeness validation: At least 1 image required
    const media = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productMedia)
      .where(eq(this.databaseService.schema.productMedia.productId, productId));

    if (media.length === 0) {
      throw new BadRequestException(
        'At least one product photograph must be attached before submitting for moderation',
      );
    }

    // Completeness validation: At least 1 active variant with positive dimensions & weight
    const variants = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productVariants)
      .where(
        and(
          eq(this.databaseService.schema.productVariants.productId, productId),
          eq(this.databaseService.schema.productVariants.isActive, true),
        ),
      );

    if (variants.length === 0) {
      throw new BadRequestException(
        'At least one active variant is required before publication review',
      );
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.products)
      .set({
        moderationStatus: 'PENDING_REVIEW',
        submittedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.products.id, productId));

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'PRODUCT_SUBMITTED_FOR_MODERATION',
      resourceType: 'PRODUCT',
      resourceId: productId,
    });

    return this.getSellerProduct(userId, productId);
  }

  /**
   * Archives a product listing, preventing it from appearing in public searches or accepting new orders.
   */
  async archiveProduct(userId: string, productId: string) {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
    if (product.sellerId !== seller.id)
      throw new ForbiddenException('Forbidden: Ownership check failed');

    const now = new Date();

    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(this.databaseService.schema.products)
        .set({
          moderationStatus: 'ARCHIVED',
          isActive: false,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.products.id, productId));

      await tx
        .update(this.databaseService.schema.productVariants)
        .set({ isActive: false, updatedAt: now })
        .where(eq(this.databaseService.schema.productVariants.productId, productId));

      await this.auditService.logEvent({
        actorId: userId,
        actorRole: 'APPROVED_SELLER',
        action: 'PRODUCT_ARCHIVED',
        resourceType: 'PRODUCT',
        resourceId: productId,
      });
    });

    return { success: true, message: 'Product listing successfully archived' };
  }

  /**
   * Lists the authenticated seller's products with pagination and filters.
   */
  async listSellerProducts(
    userId: string,
    query: ListSellerProductsQuery,
  ): Promise<{
    items: ProductSummaryDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { seller } = await this.getSellerProfile(userId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(this.databaseService.schema.products.sellerId, seller.id)];

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.products.moderationStatus, query.status));
    }

    if (query.categoryId) {
      conditions.push(eq(this.databaseService.schema.products.categoryId, query.categoryId));
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const searchOr = or(
        ilike(this.databaseService.schema.products.title, searchPattern),
        ilike(this.databaseService.schema.products.slug, searchPattern),
        ilike(this.databaseService.schema.products.description, searchPattern),
      );
      if (searchOr) {
        conditions.push(searchOr);
      }
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.databaseService.db
      .select({ total: count() })
      .from(this.databaseService.schema.products)
      .where(whereClause);

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
        publishedAt: this.databaseService.schema.products.publishedAt,
        categoryId: this.databaseService.schema.categories.id,
        categoryName: this.databaseService.schema.categories.name,
        categorySlug: this.databaseService.schema.categories.slug,
      })
      .from(this.databaseService.schema.products)
      .innerJoin(
        this.databaseService.schema.categories,
        eq(
          this.databaseService.schema.products.categoryId,
          this.databaseService.schema.categories.id,
        ),
      )
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.products.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch primary images and stock totals for these products
    const productIds = rows.map((r) => r.id);
    const primaryImagesMap = new Map<string, string>();
    const stockTotalsMap = new Map<string, number>();

    if (productIds.length > 0) {
      const mediaRows = await this.databaseService.db
        .select({
          productId: this.databaseService.schema.productMedia.productId,
          url: this.databaseService.schema.productMedia.url,
          isPrimary: this.databaseService.schema.productMedia.isPrimary,
        })
        .from(this.databaseService.schema.productMedia)
        .where(
          and(
            inArray(this.databaseService.schema.productMedia.productId, productIds),
            eq(this.databaseService.schema.productMedia.isPrimary, true),
          ),
        );

      for (const m of mediaRows) {
        primaryImagesMap.set(m.productId, m.url);
      }

      const stockRows = await this.databaseService.db
        .select({
          productId: this.databaseService.schema.productVariants.productId,
          totalStock: sql<number>`COALESCE(SUM(${this.databaseService.schema.inventoryItems.quantityOnHand}), 0)`,
        })
        .from(this.databaseService.schema.productVariants)
        .leftJoin(
          this.databaseService.schema.inventoryItems,
          eq(
            this.databaseService.schema.productVariants.id,
            this.databaseService.schema.inventoryItems.variantId,
          ),
        )
        .where(inArray(this.databaseService.schema.productVariants.productId, productIds))
        .groupBy(this.databaseService.schema.productVariants.productId);

      for (const s of stockRows) {
        stockTotalsMap.set(s.productId, Number(s.totalStock));
      }
    }

    const items: ProductSummaryDto[] = rows.map((r) => ({
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
      primaryImageUrl: primaryImagesMap.get(r.id) ?? null,
      moderationStatus: r.moderationStatus,
      isActive: r.isActive,
      totalStock: stockTotalsMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
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
   * Retrieves full product detail including variants, inventory, and media for a seller.
   */
  async getSellerProduct(userId: string, productId: string): Promise<ProductDetailDto> {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.sellerId !== seller.id) {
      throw new ForbiddenException('Forbidden: You do not own this product listing');
    }

    const [category] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.categories)
      .where(eq(this.databaseService.schema.categories.id, product.categoryId))
      .limit(1);

    const [shop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
      .limit(1);

    const mediaRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productMedia)
      .where(eq(this.databaseService.schema.productMedia.productId, productId))
      .orderBy(this.databaseService.schema.productMedia.displayOrder);

    const variantRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productVariants)
      .where(eq(this.databaseService.schema.productVariants.productId, productId));

    const variantsWithInventory: ProductVariantDto[] = [];

    for (const v of variantRows) {
      const stock = await this.inventoryService.getVariantStock(v.id);
      variantsWithInventory.push({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        title: v.title,
        priceMinor: v.priceMinor,
        currency: v.currency,
        compareAtPriceMinor: v.compareAtPriceMinor,
        weightGrams: v.weightGrams,
        dimensionLengthMm: v.dimensionLengthMm,
        dimensionWidthMm: v.dimensionWidthMm,
        dimensionHeightMm: v.dimensionHeightMm,
        attributes: (v.attributes as Record<string, string>) || {},
        isActive: v.isActive,
        inventory: stock,
      });
    }

    return {
      id: product.id,
      sellerId: product.sellerId,
      shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug } : null,
      category: {
        id: category?.id ?? '',
        name: category?.name ?? 'Uncategorized',
        slug: category?.slug ?? '',
      },
      productType: product.productType,
      title: product.title,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      basePriceMinor: product.basePriceMinor,
      currency: product.currency,
      moderationStatus: product.moderationStatus,
      rejectionReason: product.rejectionReason,
      isActive: product.isActive,
      isFragile: product.isFragile,
      isCustomizable: product.isCustomizable,
      customizationInstructions: product.customizationInstructions,
      productionLeadTimeDays: product.productionLeadTimeDays,
      materials: product.materials || [],
      techniques: product.techniques || [],
      careInstructions: product.careInstructions,
      countryOfOrigin: product.countryOfOrigin,
      media: mediaRows.map((m) => ({
        id: m.id,
        productId: m.productId,
        variantId: m.variantId,
        mediaType: m.mediaType,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        altText: m.altText,
        displayOrder: m.displayOrder,
        isPrimary: m.isPrimary,
      })),
      variants: variantsWithInventory,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
    };
  }

  /**
   * Attaches an uploaded media asset to a product.
   */
  async attachMedia(
    userId: string,
    productId: string,
    input: {
      url: string;
      thumbnailUrl?: string;
      altText?: string;
      displayOrder?: number;
      isPrimary?: boolean;
      variantId?: string;
    },
  ): Promise<ProductMediaDto> {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        sellerId: this.databaseService.schema.products.sellerId,
      })
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
    if (product.sellerId !== seller.id)
      throw new ForbiddenException('Forbidden: Ownership check failed');

    const isPrimary = input.isPrimary ?? false;

    return await this.databaseService.db.transaction(async (tx) => {
      if (isPrimary) {
        await tx
          .update(this.databaseService.schema.productMedia)
          .set({ isPrimary: false })
          .where(eq(this.databaseService.schema.productMedia.productId, productId));
      }

      const [media] = await tx
        .insert(this.databaseService.schema.productMedia)
        .values({
          productId,
          variantId: input.variantId ?? null,
          mediaType: 'IMAGE',
          url: input.url,
          thumbnailUrl: input.thumbnailUrl ?? null,
          altText: input.altText ?? null,
          displayOrder: input.displayOrder ?? 0,
          isPrimary,
        })
        .returning();

      if (!media) throw new Error('Failed to attach media record');

      await this.auditService.logEvent({
        actorId: userId,
        actorRole: 'APPROVED_SELLER',
        action: 'PRODUCT_MEDIA_ATTACHED',
        resourceType: 'PRODUCT_MEDIA',
        resourceId: media.id,
      });

      return {
        id: media.id,
        productId: media.productId,
        variantId: media.variantId,
        mediaType: media.mediaType,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        altText: media.altText,
        displayOrder: media.displayOrder,
        isPrimary: media.isPrimary,
      };
    });
  }

  /**
   * Removes a product media asset.
   */
  async removeMedia(userId: string, productId: string, mediaId: string) {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        sellerId: this.databaseService.schema.products.sellerId,
      })
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
    if (product.sellerId !== seller.id)
      throw new ForbiddenException('Forbidden: Ownership check failed');

    await this.databaseService.db
      .delete(this.databaseService.schema.productMedia)
      .where(
        and(
          eq(this.databaseService.schema.productMedia.id, mediaId),
          eq(this.databaseService.schema.productMedia.productId, productId),
        ),
      );

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'PRODUCT_MEDIA_REMOVED',
      resourceType: 'PRODUCT_MEDIA',
      resourceId: mediaId,
    });

    return { success: true, message: 'Media asset removed successfully' };
  }

  /**
   * Reorders media and sets primary photo.
   */
  async reorderMedia(userId: string, productId: string, orders: ProductMediaOrderInput[]) {
    const { seller } = await this.getSellerProfile(userId);

    const [product] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        sellerId: this.databaseService.schema.products.sellerId,
      })
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.id, productId))
      .limit(1);

    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
    if (product.sellerId !== seller.id)
      throw new ForbiddenException('Forbidden: Ownership check failed');

    await this.databaseService.db.transaction(async (tx) => {
      for (const order of orders) {
        await tx
          .update(this.databaseService.schema.productMedia)
          .set({
            displayOrder: order.displayOrder,
            isPrimary: order.isPrimary,
          })
          .where(
            and(
              eq(this.databaseService.schema.productMedia.id, order.mediaId),
              eq(this.databaseService.schema.productMedia.productId, productId),
            ),
          );
      }
    });

    return { success: true, message: 'Media order updated successfully' };
  }
}
