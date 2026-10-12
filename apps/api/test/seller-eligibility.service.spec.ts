import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { SellerEligibilityService } from '../src/modules/sellers/seller-eligibility.service';

describe('SellerEligibilityService Tests', () => {
  let dbService: DatabaseService;
  let eligibilityService: SellerEligibilityService;
  let testUserId: string;
  let testSellerId: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    eligibilityService = new SellerEligibilityService(dbService);

    // Create a test user
    const [user] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `eligibility.test.${Date.now()}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Eligibility',
        lastName: 'Tester',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();

    testUserId = user.id;

    // Create a draft seller profile
    const [seller] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: testUserId,
        legalName: 'Test Pottery Guild',
        businessType: 'INDIVIDUAL',
        verificationStatus: 'DRAFT',
      })
      .returning();

    testSellerId = seller.id;
  });

  afterAll(async () => {
    if (testSellerId) {
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, testSellerId));
    }
    if (testUserId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, testUserId));
    }
    await dbService.onModuleDestroy();
  });

  it('rejects eligibility for nonexistent seller profile', async () => {
    await expect(
      eligibilityService.checkSellerEligibility('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Seller profile not found');
  });

  it('returns ineligible when seller verification status is DRAFT', async () => {
    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(false);
    expect(result.canPublishProducts).toBe(false);
    expect(result.canReceivePayouts).toBe(false);
    expect(result.verificationStatus).toBe('DRAFT');
    expect(result.reason).toContain('DRAFT');
  });

  it('returns ineligible when seller verification status is PENDING_REVIEW', async () => {
    await dbService.db
      .update(dbService.schema.sellerProfiles)
      .set({ verificationStatus: 'PENDING_REVIEW' })
      .where(eq(dbService.schema.sellerProfiles.id, testSellerId));

    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(false);
    expect(result.canPublishProducts).toBe(false);
    expect(result.verificationStatus).toBe('PENDING_REVIEW');
  });

  it('returns ineligible when seller verification status is REJECTED', async () => {
    await dbService.db
      .update(dbService.schema.sellerProfiles)
      .set({ verificationStatus: 'REJECTED' })
      .where(eq(dbService.schema.sellerProfiles.id, testSellerId));

    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(false);
    expect(result.verificationStatus).toBe('REJECTED');
  });

  it('returns ineligible when seller is SUSPENDED', async () => {
    await dbService.db
      .update(dbService.schema.sellerProfiles)
      .set({ verificationStatus: 'SUSPENDED' })
      .where(eq(dbService.schema.sellerProfiles.id, testSellerId));

    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(false);
    expect(result.verificationStatus).toBe('SUSPENDED');
    expect(result.reason).toContain('suspended');
  });

  it('returns eligible when seller is VERIFIED and user is ACTIVE', async () => {
    await dbService.db
      .update(dbService.schema.sellerProfiles)
      .set({ verificationStatus: 'VERIFIED', isPayoutEnabled: true })
      .where(eq(dbService.schema.sellerProfiles.id, testSellerId));

    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(true);
    expect(result.canPublishProducts).toBe(true);
    expect(result.canReceivePayouts).toBe(true);
    expect(result.verificationStatus).toBe('VERIFIED');
  });

  it('returns ineligible when user account is SUSPENDED even if seller is VERIFIED', async () => {
    await dbService.db
      .update(dbService.schema.users)
      .set({ status: 'SUSPENDED' })
      .where(eq(dbService.schema.users.id, testUserId));

    const result = await eligibilityService.checkSellerEligibility(testSellerId);
    expect(result.isEligibleToSell).toBe(false);
    expect(result.canPublishProducts).toBe(false);
    expect(result.reason).toContain('suspended or deactivated');

    // Restore user status
    await dbService.db
      .update(dbService.schema.users)
      .set({ status: 'ACTIVE' })
      .where(eq(dbService.schema.users.id, testUserId));
  });
});
