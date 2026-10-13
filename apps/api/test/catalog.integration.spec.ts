import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CategoriesService } from '../src/modules/catalog/categories.service';
import { InventoryService } from '../src/modules/catalog/inventory.service';
import { ProductMediaService } from '../src/modules/catalog/product-media.service';
import { ProductManagementService } from '../src/modules/catalog/product-management.service';
import { PublicCatalogService } from '../src/modules/catalog/public-catalog.service';
import { ProductModerationService } from '../src/modules/catalog/product-moderation.service';
import { SellerEligibilityService } from '../src/modules/sellers/seller-eligibility.service';

describe('G06: Product Catalogue, Listing Management & Inventory Integration', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let categoriesService: CategoriesService;
  let inventoryService: InventoryService;
  let mediaService: ProductMediaService;
  let eligibilityService: SellerEligibilityService;
  let productService: ProductManagementService;
  let catalogService: PublicCatalogService;
  let moderationService: ProductModerationService;

  const uniqueSuffix = `${Date.now()}-cat-${Math.random().toString(36).substring(2, 7)}`;

  let verifiedSellerUser: { id: string; email: string };
  let verifiedSellerProfileId: string;
  let _verifiedShopId: string;

  let unverifiedSellerUser: { id: string; email: string };
  let unverifiedSellerProfileId: string;

  let otherSellerUser: { id: string; email: string };
  let otherSellerProfileId: string;

  let adminReviewerUser: { id: string; email: string };

  let testCategoryId: string;
  let testCategorySlug: string;

  let createdProductId: string;
  let createdVariantId: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    categoriesService = new CategoriesService(dbService);
    inventoryService = new InventoryService(dbService, auditService);
    mediaService = new ProductMediaService();
    eligibilityService = new SellerEligibilityService(dbService);
    productService = new ProductManagementService(
      dbService,
      auditService,
      eligibilityService,
      inventoryService,
    );
    catalogService = new PublicCatalogService(dbService, inventoryService);
    moderationService = new ProductModerationService(dbService, auditService);

    // Seed/Fetch categories
    const categories = await categoriesService.listCategories();
    expect(categories.length).toBeGreaterThan(0);
    testCategoryId = categories[0]!.id;
    testCategorySlug = categories[0]!.slug;

    // 1. Create Verified Seller A
    const [userA] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.a.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Ananya',
        lastName: 'Roy',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    verifiedSellerUser = userA!;

    const [sellerA] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: verifiedSellerUser.id,
        legalName: 'Ananya Handcrafted Pottery LLP',
        businessType: 'REGISTERED_COMPANY',
        taxId: '29ABCDE1234F1Z5',
        verificationStatus: 'VERIFIED',
        termsAcceptedVersion: '1.0',
        termsAcceptedAt: new Date(),
        verifiedAt: new Date(),
      })
      .returning();
    verifiedSellerProfileId = sellerA!.id;

    const [shopA] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: verifiedSellerProfileId,
        name: 'Terracotta Dreams',
        slug: `terracotta-dreams-${uniqueSuffix}`,
        description: 'Authentic clay pottery from Bengal artisans',
      })
      .returning();
    _verifiedShopId = shopA!.id;

    // 2. Create Unverified Seller B
    const [userB] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.b.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Karan',
        lastName: 'Verma',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    unverifiedSellerUser = userB!;

    const [sellerB] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: unverifiedSellerUser.id,
        legalName: 'Karan Woodcrafts',
        businessType: 'INDIVIDUAL',
        verificationStatus: 'PENDING_REVIEW',
        termsAcceptedVersion: '1.0',
        termsAcceptedAt: new Date(),
      })
      .returning();
    unverifiedSellerProfileId = sellerB!.id;

    // 3. Create Other Verified Seller C (for isolation checks)
    const [userC] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.c.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Farhan',
        lastName: 'Qureshi',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    otherSellerUser = userC!;

    const [sellerC] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: otherSellerUser.id,
        legalName: 'Farhan Silversmiths',
        businessType: 'INDIVIDUAL',
        taxId: '27ABCDE5678F1Z2',
        verificationStatus: 'VERIFIED',
        termsAcceptedVersion: '1.0',
        termsAcceptedAt: new Date(),
        verifiedAt: new Date(),
      })
      .returning();
    otherSellerProfileId = sellerC!.id;

    // 4. Create Staff Reviewer User
    const [adminUser] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `moderator.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Vikram',
        lastName: 'Sethi',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    adminReviewerUser = adminUser!;
  });

  afterAll(async () => {
    // Cleanup products
    if (createdProductId) {
      await dbService.db
        .delete(dbService.schema.moderationRecords)
        .where(eq(dbService.schema.moderationRecords.productId, createdProductId));
      await dbService.db
        .delete(dbService.schema.productMedia)
        .where(eq(dbService.schema.productMedia.productId, createdProductId));
      if (createdVariantId) {
        await dbService.db
          .delete(dbService.schema.stockAdjustments)
          .where(eq(dbService.schema.stockAdjustments.variantId, createdVariantId));
        await dbService.db
          .delete(dbService.schema.inventoryItems)
          .where(eq(dbService.schema.inventoryItems.variantId, createdVariantId));
      }
      await dbService.db
        .delete(dbService.schema.productVariants)
        .where(eq(dbService.schema.productVariants.productId, createdProductId));
      await dbService.db
        .delete(dbService.schema.products)
        .where(eq(dbService.schema.products.id, createdProductId));
    }

    // Cleanup sellers & shops
    const sellerIds = [
      verifiedSellerProfileId,
      unverifiedSellerProfileId,
      otherSellerProfileId,
    ].filter(Boolean);
    if (sellerIds.length > 0) {
      await dbService.db
        .delete(dbService.schema.shops)
        .where(inArray(dbService.schema.shops.sellerId, sellerIds));
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(inArray(dbService.schema.sellerProfiles.id, sellerIds));
    }

    // Cleanup users
    const userIds = [
      verifiedSellerUser?.id,
      unverifiedSellerUser?.id,
      otherSellerUser?.id,
      adminReviewerUser?.id,
    ].filter(Boolean);
    if (userIds.length > 0) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(inArray(dbService.schema.users.id, userIds));
    }

    await dbService.onModuleDestroy();
  });

  it('1. prevents unverified sellers from creating listing drafts (Seller Eligibility Guard)', async () => {
    await expect(
      productService.createDraft(unverifiedSellerUser.id, {
        categoryId: testCategoryId,
        productType: 'READY_TO_SHIP',
        title: 'Unverified Artisan Bowl',
        description: 'Should fail due to unverified seller status.',
        basePriceMinor: 150000,
        currency: 'INR',
      }),
    ).rejects.toThrow(/requires VERIFIED status/i);
  });

  it('2. enables verified seller to create draft listing with initial variant and inventory', async () => {
    const draft = await productService.createDraft(verifiedSellerUser.id, {
      categoryId: testCategoryId,
      productType: 'READY_TO_SHIP',
      title: 'Hand-thrown Terracotta Chai Cups (Set of 6)',
      shortDescription: 'Rustic earthen kulhad tea cups handcrafted on traditional potter wheel.',
      description:
        'Crafted from natural alluvial clay by heritage potters. Unglazed exterior with food-safe interior finish.',
      basePriceMinor: 89000, // 890.00 INR
      currency: 'INR',
      isFragile: true,
      productionLeadTimeDays: 2,
      materials: ['Natural River Clay', 'Organic Terracotta Slip'],
      techniques: ['Wheel Throwing', 'Wood Firing'],
      variants: [
        {
          sku: `KULHAD-SET6-${uniqueSuffix}`,
          title: 'Standard Terracotta 150ml (Set of 6)',
          priceMinor: 89000,
          currency: 'INR',
          weightGrams: 900,
          dimensions: {
            lengthMm: 220,
            widthMm: 150,
            heightMm: 90,
          },
          initialStock: 25,
          attributes: { size: '150ml', pack: '6' },
        },
      ],
    });

    expect(draft).toBeDefined();
    expect(draft.id).toBeDefined();
    expect(draft.moderationStatus).toBe('DRAFT');
    expect(draft.sellerId).toBe(verifiedSellerProfileId);
    expect(draft.variants.length).toBe(1);
    expect(draft.variants[0]!.inventory.quantityOnHand).toBe(25);
    expect(draft.variants[0]!.inventory.availableQuantity).toBe(25);

    createdProductId = draft.id;
    createdVariantId = draft.variants[0]!.id;
  });

  it('3. enforces multi-tenant seller isolation (Seller C cannot modify or submit Seller A listing)', async () => {
    // Other seller trying to get draft
    await expect(
      productService.getSellerProduct(otherSellerUser.id, createdProductId),
    ).rejects.toThrow(/Forbidden/i);

    // Other seller trying to update draft
    await expect(
      productService.updateProduct(otherSellerUser.id, createdProductId, {
        title: 'Malicious Update Attempt',
      }),
    ).rejects.toThrow(/Forbidden/i);

    // Other seller trying to submit draft
    await expect(
      productService.submitForModeration(otherSellerUser.id, createdProductId),
    ).rejects.toThrow(/Forbidden/i);
  });

  it('4. rejects moderation submission if listing has no photos attached (Completeness Guard)', async () => {
    await expect(
      productService.submitForModeration(verifiedSellerUser.id, createdProductId),
    ).rejects.toThrow(/At least one product photograph must be attached/i);
  });

  it('5. generates secure pre-signed media upload ticket and attaches media to product', async () => {
    const ticket = mediaService.generateUploadTicket(verifiedSellerProfileId, {
      fileName: 'terracotta-cups-hero.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048500, // ~2MB
    });

    expect(ticket.storagePath).toContain(`public/products/${verifiedSellerProfileId}/`);
    expect(ticket.presignedUploadUrl).toContain('sig=');
    expect(ticket.expiresInSeconds).toBe(900);

    // Attach uploaded media to product
    const attached = await productService.attachMedia(verifiedSellerUser.id, createdProductId, {
      url: `/media/${ticket.storagePath}`,
      altText: 'Set of six hand-thrown terracotta chai cups',
      isPrimary: true,
      displayOrder: 0,
    });

    expect(attached.id).toBeDefined();
    expect(attached.isPrimary).toBe(true);
    expect(attached.url).toBe(`/media/${ticket.storagePath}`);
  });

  it('6. successfully submits listing for moderation once complete (DRAFT -> PENDING_REVIEW)', async () => {
    const submitted = await productService.submitForModeration(
      verifiedSellerUser.id,
      createdProductId,
    );

    expect(submitted.moderationStatus).toBe('PENDING_REVIEW');
    expect(submitted.rejectionReason).toBeNull();

    // Verify it appears in admin pending moderation queue
    const pendingList = await moderationService.listPending({ page: 1, limit: 10 });
    const match = pendingList.items.find((item) => item.id === createdProductId);
    expect(match).toBeDefined();
    expect(match?.sellerName).toBe('Ananya Handcrafted Pottery LLP');
  });

  it('7. enforces Segregation of Duties (Artisan reviewer cannot moderate their own listing)', async () => {
    // Attempt moderation where reviewer is the owner of the seller profile
    await expect(
      moderationService.moderateProduct(
        createdProductId,
        verifiedSellerUser.id, // The owner!
        'SUPER_ADMIN',
        {
          decision: 'APPROVED',
          reasonCode: 'QUALITY_VERIFIED',
          notes: 'Self-approval attempt should fail.',
        },
      ),
    ).rejects.toThrow(/segregation of duties violated/i);
  });

  it('8. administrative review approves listing (PENDING_REVIEW -> PUBLISHED) with audit record', async () => {
    const decision = await moderationService.moderateProduct(
      createdProductId,
      adminReviewerUser.id,
      'TRUST_SAFETY',
      {
        decision: 'APPROVED',
        reasonCode: 'AUTHENTIC_HANDCRAFT',
        notes: 'Verified artisan technique and authentic clay material. Listing approved.',
      },
    );

    expect(decision.decision).toBe('APPROVED');
    expect(decision.moderationStatus).toBe('PUBLISHED');
    expect(decision.productId).toBe(createdProductId);

    // Verify detail reflects PUBLISHED status
    const detail = await moderationService.getProductForModeration(createdProductId);
    expect(detail.product.moderationStatus).toBe('PUBLISHED');
    expect(detail.product.isActive).toBe(true);
    expect(detail.moderationHistory.length).toBeGreaterThan(0);
    expect(detail.moderationHistory[0]!.action).toBe('APPROVED');
  });

  it('9. public catalog exposes published product while redacting seller private metadata', async () => {
    // List products
    const catalog = await catalogService.listProducts({
      categorySlug: testCategorySlug,
      minPriceMinor: 50000,
      maxPriceMinor: 100000,
    });

    const match = catalog.items.find((item) => item.id === createdProductId);
    expect(match).toBeDefined();
    expect(match?.title).toBe('Hand-thrown Terracotta Chai Cups (Set of 6)');
    expect(match?.basePriceMinor).toBe(89000);

    // Get by slug
    const detail = await catalogService.getProductBySlug(match!.slug);
    expect(detail.id).toBe(createdProductId);
    expect(detail.shop?.name).toBe('Terracotta Dreams');
    expect(detail.rejectionReason).toBeNull(); // Redacted
    expect(detail.variants.length).toBe(1);
    expect(detail.variants[0]!.inventory.quantityOnHand).toBe(25);
  });

  it('10. executes atomic inventory adjustment and prevents negative stock on hand', async () => {
    // 1. Valid increment
    const increment = await inventoryService.adjustStock(
      createdVariantId,
      {
        variantId: createdVariantId,
        quantityDelta: 10,
        reason: 'RECEIPT',
        notes: 'Freshly baked batch from kiln.',
      },
      verifiedSellerUser.id,
      'APPROVED_SELLER',
    );

    expect(increment.previousOnHand).toBe(25);
    expect(increment.newOnHand).toBe(35);
    expect(increment.quantityDelta).toBe(10);

    // 2. Reject negative inventory
    await expect(
      inventoryService.adjustStock(
        createdVariantId,
        {
          variantId: createdVariantId,
          quantityDelta: -50, // Available is only 35
          reason: 'BREAKAGE',
          notes: 'Excessive breakage claim',
        },
        verifiedSellerUser.id,
        'APPROVED_SELLER',
      ),
    ).rejects.toThrow(/Insufficient stock on hand/i);

    // 3. Current stock remains intact
    const currentStock = await inventoryService.getVariantStock(createdVariantId);
    expect(currentStock.quantityOnHand).toBe(35);
  });

  it('11. archival prevents product from appearing in public catalog searches', async () => {
    // Archive product
    const archived = await productService.archiveProduct(verifiedSellerUser.id, createdProductId);
    expect(archived.success).toBe(true);

    const product = await productService.getSellerProduct(verifiedSellerUser.id, createdProductId);
    expect(product.moderationStatus).toBe('ARCHIVED');
    expect(product.isActive).toBe(false);

    // Verify it is excluded from public catalog
    const catalog = await catalogService.listProducts({
      categorySlug: testCategorySlug,
    });
    const match = catalog.items.find((item) => item.id === createdProductId);
    expect(match).toBeUndefined();
  });
});
