import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { SellerDocumentsStorageService } from '../src/modules/sellers/seller-documents-storage.service';
import { SellerOnboardingService } from '../src/modules/sellers/seller-onboarding.service';
import { SellerReviewService } from '../src/modules/sellers/seller-review.service';
import { SellerEligibilityService } from '../src/modules/sellers/seller-eligibility.service';

describe('Seller Onboarding & Verification Integration Lifecycle', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let storageService: SellerDocumentsStorageService;
  let onboardingService: SellerOnboardingService;
  let reviewService: SellerReviewService;
  let eligibilityService: SellerEligibilityService;

  let artisanUserId: string;
  let reviewerUserId: string;
  let sellerId: string;
  let testDocumentId: string;
  const uniqueSuffix = Date.now();
  const testSlug = `craft-studio-${uniqueSuffix}`;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    storageService = new SellerDocumentsStorageService();
    onboardingService = new SellerOnboardingService(dbService, auditService, storageService);
    reviewService = new SellerReviewService(dbService, auditService, storageService);
    eligibilityService = new SellerEligibilityService(dbService);

    // 1. Create artisan user
    const [artisan] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Meera',
        lastName: 'Sharma',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    artisanUserId = artisan.id;

    // 2. Create staff reviewer user
    const [reviewer] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `reviewer.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Trust',
        lastName: 'Officer',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    reviewerUserId = reviewer.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    if (sellerId) {
      await dbService.db
        .delete(dbService.schema.sellerDocuments)
        .where(eq(dbService.schema.sellerDocuments.sellerId, sellerId));
      await dbService.db
        .delete(dbService.schema.pickupAddresses)
        .where(eq(dbService.schema.pickupAddresses.sellerId, sellerId));
      await dbService.db
        .delete(dbService.schema.shops)
        .where(eq(dbService.schema.shops.sellerId, sellerId));
      await dbService.db
        .delete(dbService.schema.userRoles)
        .where(eq(dbService.schema.userRoles.sellerId, sellerId));
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerId));
    }

    if (artisanUserId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, artisanUserId));
    }
    if (reviewerUserId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, reviewerUserId));
    }

    await dbService.onModuleDestroy();
  });

  it('1. returns missing fields checklist for a brand-new artisan user', async () => {
    const status = await onboardingService.getOnboardingStatus(artisanUserId);
    expect(status.hasProfile).toBe(false);
    expect(status.verificationStatus).toBe('DRAFT');
    expect(status.canSubmit).toBe(false);
    expect(status.missingFields).toContain('legalName');
    expect(status.missingFields).toContain('businessType');
    expect(status.missingFields).toContain('shopName');
    expect(status.missingFields).toContain('shopSlug');
    expect(status.missingFields).toContain('craftDescription');
    expect(status.missingFields).toContain('pickupAddress');
    expect(status.missingFields).toContain('verificationDocuments');
  });

  it('2. checks slug availability correctly', async () => {
    const availableResult = await onboardingService.checkSlugAvailability(testSlug);
    expect(availableResult.available).toBe(true);
  });

  it('3. saves draft onboarding profile, shop details, and pickup address', async () => {
    const updatedStatus = await onboardingService.saveDraft(artisanUserId, {
      legalName: 'Meera Pottery & Ceramics',
      businessType: 'INDIVIDUAL',
      taxId: 'GSTIN12345678',
      shopName: 'Terracotta Whispers',
      shopSlug: testSlug,
      craftDescription:
        'Handcrafted stoneware and terracotta earthenware pots, crafted on traditional potter wheels.',
      pickupAddress: {
        contactName: 'Meera Sharma',
        phone: '+919876543210',
        addressLine1: '42 Artisan Lane, Potter Colony',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'IN',
      },
    });

    expect(updatedStatus.hasProfile).toBe(true);
    expect(updatedStatus.sellerId).toBeDefined();
    sellerId = updatedStatus.sellerId!;
    expect(updatedStatus.profile?.legalName).toBe('Meera Pottery & Ceramics');
    expect(updatedStatus.shop?.name).toBe('Terracotta Whispers');
    expect(updatedStatus.shop?.slug).toBe(testSlug);
    expect(updatedStatus.pickupAddress?.city).toBe('Jaipur');
    expect(updatedStatus.missingFields).toContain('verificationDocuments');
    expect(updatedStatus.canSubmit).toBe(false); // Still needs documents
  });

  it('4. enforces document constraints: rejects invalid MIME and file size > 10MB', async () => {
    // Unsupported MIME
    expect(() =>
      storageService.validateDocumentConstraints('application/x-msdownload', 1024),
    ).toThrow('Invalid document format');

    // Exceeds 10MB
    expect(() =>
      storageService.validateDocumentConstraints('application/pdf', 15 * 1024 * 1024),
    ).toThrow('File size must be between 1 byte and 10 MB');
  });

  it('5. requests and issues pre-signed upload ticket for KYC document', async () => {
    const ticket = await onboardingService.requestDocumentUpload(artisanUserId, {
      documentType: 'GOVERNMENT_ID',
      fileName: 'artisan-id-card.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 245000,
    });

    expect(ticket.documentId).toBeDefined();
    expect(ticket.storagePath).toContain(`private/sellers/${sellerId}/GOVERNMENT_ID/`);
    expect(ticket.presignedUploadUrl).toContain('sig=');
    testDocumentId = ticket.documentId;

    const confirmRes = await onboardingService.confirmDocumentUpload(artisanUserId, testDocumentId);
    expect(confirmRes.success).toBe(true);
  });

  it('6. deletes draft document and allows re-uploading', async () => {
    // Delete the first document
    const delRes = await onboardingService.deleteDraftDocument(artisanUserId, testDocumentId);
    expect(delRes.success).toBe(true);

    const statusAfterDel = await onboardingService.getOnboardingStatus(artisanUserId);
    expect(statusAfterDel.documents.length).toBe(0);

    // Re-upload artisan certificate
    const ticket = await onboardingService.requestDocumentUpload(artisanUserId, {
      documentType: 'ARTISAN_CERTIFICATE',
      fileName: 'handicraft-council-cert.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 180000,
    });
    testDocumentId = ticket.documentId;
    await onboardingService.confirmDocumentUpload(artisanUserId, testDocumentId);

    const statusWithDoc = await onboardingService.getOnboardingStatus(artisanUserId);
    expect(statusWithDoc.documents.length).toBe(1);
    expect(statusWithDoc.canSubmit).toBe(true);
  });

  it('7. submits application: transitions to PENDING_REVIEW and assigns SELLER_APPLICANT role', async () => {
    const submitResult = await onboardingService.submitApplication(artisanUserId, {
      legalName: 'Meera Pottery & Ceramics',
      businessType: 'INDIVIDUAL',
      taxId: 'GSTIN12345678',
      shopName: 'Terracotta Whispers',
      shopSlug: testSlug,
      craftDescription:
        'Handcrafted stoneware and terracotta earthenware pots, crafted on traditional potter wheels.',
      pickupAddress: {
        contactName: 'Meera Sharma',
        phone: '+919876543210',
        addressLine1: '42 Artisan Lane, Potter Colony',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'IN',
      },
      termsAcceptedVersion: 'v1.0-2026',
    });

    expect(submitResult.status).toBe('PENDING_REVIEW');
    expect(submitResult.submittedAt).toBeDefined();

    // Verify role in userRoles
    const roles = await dbService.db
      .select({ roleName: dbService.schema.roles.name })
      .from(dbService.schema.userRoles)
      .innerJoin(
        dbService.schema.roles,
        eq(dbService.schema.userRoles.roleId, dbService.schema.roles.id),
      )
      .where(eq(dbService.schema.userRoles.userId, artisanUserId));

    expect(roles.some((r) => r.roleName === 'SELLER_APPLICANT')).toBe(true);
  });

  it('8. prevents resubmitting an application that is already PENDING_REVIEW', async () => {
    await expect(
      onboardingService.submitApplication(artisanUserId, {
        legalName: 'Meera Pottery & Ceramics',
        businessType: 'INDIVIDUAL',
        shopName: 'Terracotta Whispers',
        shopSlug: testSlug,
        craftDescription: 'Handcrafted stoneware pots',
        pickupAddress: {
          contactName: 'Meera Sharma',
          phone: '+919876543210',
          addressLine1: '42 Artisan Lane',
          city: 'Jaipur',
          state: 'Rajasthan',
          postalCode: '302001',
          country: 'IN',
        },
        termsAcceptedVersion: 'v1.0-2026',
      }),
    ).rejects.toThrow('Application is already under compliance review');
  });

  it('9. enforces segregation of duties: applicant cannot review their own application', async () => {
    await expect(
      reviewService.reviewApplication(sellerId, artisanUserId, 'SUPER_ADMIN', {
        decision: 'APPROVED',
      }),
    ).rejects.toThrow('Reviewers cannot approve or review their own seller applications');
  });

  it('10. administrative review workspace: lists applications and views details with secure download URLs', async () => {
    const listRes = await reviewService.listApplications({
      status: 'PENDING_REVIEW',
      search: 'Terracotta',
    });

    expect(listRes.items.length).toBeGreaterThanOrEqual(1);
    const item = listRes.items.find((i) => i.sellerId === sellerId);
    expect(item).toBeDefined();
    expect(item?.legalName).toBe('Meera Pottery & Ceramics');
    expect(item?.verificationStatus).toBe('PENDING_REVIEW');
    expect(item?.documentCount).toBe(1);

    const detail = await reviewService.getApplicationDetail(sellerId, reviewerUserId);
    expect(detail.sellerId).toBe(sellerId);
    expect(detail.documents.length).toBe(1);
    expect(detail.documents[0]?.downloadUrl).toContain('sig=');
    expect(detail.documents[0]?.downloadUrl).toContain(`reviewer=${reviewerUserId}`);
  });

  it('11. reviewer requests ACTION_REQUIRED: transitions back to DRAFT with feedback', async () => {
    const actionRequiredResult = await reviewService.reviewApplication(
      sellerId,
      reviewerUserId,
      'TRUST_SAFETY',
      {
        decision: 'ACTION_REQUIRED',
        reasonNotes: 'Please provide high-resolution photo proof of the workshop.',
      },
    );

    expect(actionRequiredResult.decision).toBe('ACTION_REQUIRED');
    expect(actionRequiredResult.verificationStatus).toBe('DRAFT');

    const status = await onboardingService.getOnboardingStatus(artisanUserId);
    expect(status.verificationStatus).toBe('DRAFT');
    expect(status.profile?.rejectionReason).toContain('high-resolution photo proof');
  });

  it('12. artisan resubmits and reviewer APPROVES: transitions to VERIFIED and promotes role to APPROVED_SELLER', async () => {
    // Artisan resubmits
    await onboardingService.submitApplication(artisanUserId, {
      legalName: 'Meera Pottery & Ceramics',
      businessType: 'INDIVIDUAL',
      taxId: 'GSTIN12345678',
      shopName: 'Terracotta Whispers',
      shopSlug: testSlug,
      craftDescription:
        'Handcrafted stoneware and terracotta earthenware pots, crafted on traditional potter wheels.',
      pickupAddress: {
        contactName: 'Meera Sharma',
        phone: '+919876543210',
        addressLine1: '42 Artisan Lane, Potter Colony',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'IN',
      },
      termsAcceptedVersion: 'v1.0-2026',
    });

    // Reviewer approves
    const approvedResult = await reviewService.reviewApplication(
      sellerId,
      reviewerUserId,
      'TRUST_SAFETY',
      {
        decision: 'APPROVED',
        reasonNotes: 'Credentials verified and authentic handcrafted quality confirmed.',
      },
    );

    expect(approvedResult.decision).toBe('APPROVED');
    expect(approvedResult.verificationStatus).toBe('VERIFIED');

    // Verify role is now APPROVED_SELLER
    const roles = await dbService.db
      .select({ roleName: dbService.schema.roles.name })
      .from(dbService.schema.userRoles)
      .innerJoin(
        dbService.schema.roles,
        eq(dbService.schema.userRoles.roleId, dbService.schema.roles.id),
      )
      .where(eq(dbService.schema.userRoles.userId, artisanUserId));

    expect(roles.some((r) => r.roleName === 'APPROVED_SELLER')).toBe(true);

    // Verify document marked VERIFIED
    const docs = await dbService.db
      .select()
      .from(dbService.schema.sellerDocuments)
      .where(eq(dbService.schema.sellerDocuments.sellerId, sellerId));
    expect(docs[0]?.status).toBe('VERIFIED');

    // Check Seller Eligibility
    const eligibility = await eligibilityService.checkSellerEligibility(sellerId);
    expect(eligibility.isEligibleToSell).toBe(true);
    expect(eligibility.canPublishProducts).toBe(true);
  });

  it('13. handles administrative suspension and reinstatement', async () => {
    // 1. Suspend
    const suspendRes = await reviewService.suspendSeller(sellerId, reviewerUserId, 'SUPER_ADMIN', {
      reason: 'Under investigation for counterfeit inquiry (artisan cleared on verification)',
    });
    expect(suspendRes.verificationStatus).toBe('SUSPENDED');

    // Ineligible to sell while suspended
    const ineligible = await eligibilityService.checkSellerEligibility(sellerId);
    expect(ineligible.isEligibleToSell).toBe(false);
    expect(ineligible.canPublishProducts).toBe(false);

    // 2. Reinstate
    const reinstateRes = await reviewService.reinstateSeller(
      sellerId,
      reviewerUserId,
      'SUPER_ADMIN',
    );
    expect(reinstateRes.verificationStatus).toBe('VERIFIED');

    // Eligible to sell once reinstated
    const reinstated = await eligibilityService.checkSellerEligibility(sellerId);
    expect(reinstated.isEligibleToSell).toBe(true);
    expect(reinstated.canPublishProducts).toBe(true);
  });
});
