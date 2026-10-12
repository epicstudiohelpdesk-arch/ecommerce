import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, or, ilike, sql, count, desc, asc, inArray, gte, lte } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { InventoryService } from './inventory.service';
import type { ListPublicCatalogQuery } from '@repo/validation';
import type { ProductSummaryDto, ProductDetailDto, ProductVariantDto } from '@repo/api-contracts';

@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Retrieves paginated public listings of published handcrafted products.
   * Enforces publication state, seller verification, and excludes private metadata.
   */
  async listProducts(query: ListPublicCatalogQuery): Promise<{
    items: ProductSummaryDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [
      // Only PUBLISHED or APPROVED listings
      or(
        eq(this.databaseService.schema.products.moderationStatus, 'PUBLISHED'),
        eq(this.databaseService.schema.products.moderationStatus, 'APPROVED'),
      ),
      eq(this.databaseService.schema.products.isActive, true),
      eq(this.databaseService.schema.sellerProfiles.verificationStatus, 'VERIFIED'),
    ];

    if (query.productType) {
      conditions.push(eq(this.databaseService.schema.products.productType, query.productType));
    }

    if (query.minPriceMinor !== undefined) {
      conditions.push(
        gte(this.databaseService.schema.products.basePriceMinor, query.minPriceMinor),
      );
    }

    if (query.maxPriceMinor !== undefined) {
      conditions.push(
        lte(this.databaseService.schema.products.basePriceMinor, query.maxPriceMinor),
      );
    }

    if (query.categorySlug) {
      conditions.push(eq(this.databaseService.schema.categories.slug, query.categorySlug));
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(this.databaseService.schema.products.title, searchPattern),
          ilike(this.databaseService.schema.products.shortDescription, searchPattern),
          ilike(this.databaseService.schema.products.description, searchPattern),
        ),
      );
    }

    const whereClause = and(...conditions);

    // Total count query
    const [countResult] = await this.databaseService.db
      .select({ total: count() })
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
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    // Sort order
    let orderByClause;
    switch (query.sort) {
      case 'price_asc':
        orderByClause = asc(this.databaseService.schema.products.basePriceMinor);
        break;
      case 'price_desc':
        orderByClause = desc(this.databaseService.schema.products.basePriceMinor);
        break;
      case 'title_asc':
        orderByClause = asc(this.databaseService.schema.products.title);
        break;
      case 'newest':
      default:
        orderByClause = desc(this.databaseService.schema.products.createdAt);
        break;
    }

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
      .innerJoin(
        this.databaseService.schema.sellerProfiles,
        eq(
          this.databaseService.schema.products.sellerId,
          this.databaseService.schema.sellerProfiles.id,
        ),
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Primary images & stock totals
    const productIds = rows.map((r) => r.id);
    const primaryImagesMap = new Map<string, string>();
    const stockTotalsMap = new Map<string, number>();

    if (productIds.length > 0) {
      const mediaRows = await this.databaseService.db
        .select({
          productId: this.databaseService.schema.productMedia.productId,
          url: this.databaseService.schema.productMedia.url,
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
   * Retrieves a single published product by public slug.
   */
  async getProductBySlug(slug: string): Promise<ProductDetailDto> {
    const [product] = await this.databaseService.db
      .select({
        product: this.databaseService.schema.products,
        category: this.databaseService.schema.categories,
        seller: this.databaseService.schema.sellerProfiles,
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
      .where(
        and(
          eq(this.databaseService.schema.products.slug, slug),
          or(
            eq(this.databaseService.schema.products.moderationStatus, 'PUBLISHED'),
            eq(this.databaseService.schema.products.moderationStatus, 'APPROVED'),
          ),
          eq(this.databaseService.schema.products.isActive, true),
          eq(this.databaseService.schema.sellerProfiles.verificationStatus, 'VERIFIED'),
        ),
      )
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product '${slug}' not found or is currently unavailable`);
    }

    const [shop] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.shops.id,
        name: this.databaseService.schema.shops.name,
        slug: this.databaseService.schema.shops.slug,
      })
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, product.seller.id))
      .limit(1);

    const mediaRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productMedia)
      .where(eq(this.databaseService.schema.productMedia.productId, product.product.id))
      .orderBy(this.databaseService.schema.productMedia.displayOrder);

    const variantRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.productVariants)
      .where(
        and(
          eq(this.databaseService.schema.productVariants.productId, product.product.id),
          eq(this.databaseService.schema.productVariants.isActive, true),
        ),
      );

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
      id: product.product.id,
      sellerId: product.seller.id,
      shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug } : null,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      productType: product.product.productType as string,
      title: product.product.title,
      slug: product.product.slug,
      shortDescription: product.product.shortDescription,
      description: product.product.description,
      basePriceMinor: product.product.basePriceMinor,
      currency: product.product.currency,
      moderationStatus: product.product.moderationStatus,
      rejectionReason: null, // Redacted for public view
      isActive: product.product.isActive,
      isFragile: product.product.isFragile,
      isCustomizable: product.product.isCustomizable,
      customizationInstructions: product.product.customizationInstructions,
      productionLeadTimeDays: product.product.productionLeadTimeDays,
      materials: product.product.materials || [],
      techniques: product.product.techniques || [],
      careInstructions: product.product.careInstructions,
      countryOfOrigin: product.product.countryOfOrigin,
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
      createdAt: product.product.createdAt.toISOString(),
      updatedAt: product.product.updatedAt.toISOString(),
      publishedAt: product.product.publishedAt ? product.product.publishedAt.toISOString() : null,
    };
  }
}
