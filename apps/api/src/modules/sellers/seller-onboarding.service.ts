import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SellerDocumentsStorageService } from './seller-documents-storage.service';
import type {
  SaveDraftSellerInput,
  SellerApplicationSubmitInput,
  PresignedDocumentRequestInput,
} from '@repo/validation';
import type { SellerOnboardingStatus, PresignedDocumentUploadTicket } from '@repo/api-contracts';

@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly storageService: SellerDocumentsStorageService,
  ) {}

  /**
   * Retrieves the current onboarding progress, draft data, KYC documents, and missing fields.
   */
  async getOnboardingStatus(userId: string): Promise<SellerOnboardingStatus> {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) {
      return {
        hasProfile: false,
        verificationStatus: 'DRAFT',
        documents: [],
        missingFields: [
          'legalName',
          'businessType',
          'shopName',
          'shopSlug',
          'craftDescription',
          'pickupAddress',
          'verificationDocuments',
        ],
        canSubmit: false,
      };
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
      .select({
        id: this.databaseService.schema.sellerDocuments.id,
        documentType: this.databaseService.schema.sellerDocuments.documentType,
        fileName: this.databaseService.schema.sellerDocuments.fileName,
        fileSizeBytes: this.databaseService.schema.sellerDocuments.fileSizeBytes,
        mimeType: this.databaseService.schema.sellerDocuments.mimeType,
        status: this.databaseService.schema.sellerDocuments.status,
        reviewNotes: this.databaseService.schema.sellerDocuments.reviewNotes,
        createdAt: this.databaseService.schema.sellerDocuments.createdAt,
      })
      .from(this.databaseService.schema.sellerDocuments)
      .where(eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id));

    // Calculate missing fields checklist
    const missingFields: string[] = [];
    if (!seller.legalName) missingFields.push('legalName');
    if (!seller.businessType) missingFields.push('businessType');
    if (!shop?.name) missingFields.push('shopName');
    if (!shop?.slug) missingFields.push('shopSlug');
    if (!shop?.craftStory) missingFields.push('craftDescription');
    if (!pickupAddress) missingFields.push('pickupAddress');
    if (documents.length === 0) missingFields.push('verificationDocuments');

    return {
      hasProfile: true,
      sellerId: seller.id,
      verificationStatus: seller.verificationStatus,
      profile: {
        legalName: seller.legalName,
        businessType: seller.businessType,
        taxId: seller.taxId,
        rejectionReason: seller.rejectionReason,
        submittedAt: seller.submittedAt ? seller.submittedAt.toISOString() : null,
        verifiedAt: seller.verifiedAt ? seller.verifiedAt.toISOString() : null,
      },
      shop: shop
        ? {
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            description: shop.description,
            craftStory: shop.craftStory,
            logoUrl: shop.logoUrl,
          }
        : undefined,
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
        : undefined,
      documents: documents.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
      missingFields,
      canSubmit:
        missingFields.length === 0 &&
        (seller.verificationStatus === 'DRAFT' || seller.verificationStatus === 'REJECTED'),
    };
  }

  /**
   * Verifies if a proposed shop slug is globally unique and formatted properly.
   */
  async checkSlugAvailability(
    slug: string,
    currentSellerId?: string,
  ): Promise<{ available: boolean; message: string }> {
    const normalizedSlug = slug.trim().toLowerCase();

    const query = this.databaseService.db
      .select({
        id: this.databaseService.schema.shops.id,
        sellerId: this.databaseService.schema.shops.sellerId,
      })
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.slug, normalizedSlug))
      .limit(1);

    const [existing] = await query;

    if (!existing) {
      return { available: true, message: 'Shop slug is available' };
    }

    if (currentSellerId && existing.sellerId === currentSellerId) {
      return { available: true, message: 'Shop slug belongs to current shop draft' };
    }

    return { available: false, message: 'This shop URL slug is already taken by another artisan' };
  }

  /**
   * Saves or updates a draft application without transitioning the review status.
   */
  async saveDraft(userId: string, input: SaveDraftSellerInput): Promise<SellerOnboardingStatus> {
    let [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    // 1. Check slug uniqueness if provided
    if (input.shopSlug) {
      const availability = await this.checkSlugAvailability(input.shopSlug, seller?.id);
      if (!availability.available) {
        throw new ConflictException(availability.message);
      }
    }

    // 2. Upsert Seller Profile
    if (!seller) {
      const [createdSeller] = await this.databaseService.db
        .insert(this.databaseService.schema.sellerProfiles)
        .values({
          userId,
          legalName: input.legalName || 'Draft Artisan',
          businessType: input.businessType || 'INDIVIDUAL',
          taxId: input.taxId || null,
          verificationStatus: 'DRAFT',
        })
        .returning();

      if (!createdSeller)
        throw new InternalServerErrorException('Failed to create seller profile draft');
      seller = createdSeller;
    } else {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.legalName !== undefined) updateData['legalName'] = input.legalName;
      if (input.businessType !== undefined) updateData['businessType'] = input.businessType;
      if (input.taxId !== undefined) updateData['taxId'] = input.taxId;

      const [updatedSeller] = await this.databaseService.db
        .update(this.databaseService.schema.sellerProfiles)
        .set(updateData)
        .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id))
        .returning();

      if (updatedSeller) seller = updatedSeller;
    }

    // 3. Upsert Shop Draft
    if (input.shopName || input.shopSlug || input.craftDescription) {
      const [existingShop] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.shops)
        .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
        .limit(1);

      if (!existingShop) {
        await this.databaseService.db
          .insert(this.databaseService.schema.shops)
          .values({
            sellerId: seller.id,
            name: input.shopName || 'My Artisan Shop',
            slug: input.shopSlug || `shop-${seller.id.substring(0, 8)}`,
            description: input.craftDescription || null,
            craftStory: input.craftDescription || null,
          })
          .returning();
      } else {
        const shopUpdateData: Record<string, unknown> = { updatedAt: new Date() };
        if (input.shopName !== undefined) shopUpdateData['name'] = input.shopName;
        if (input.shopSlug !== undefined) shopUpdateData['slug'] = input.shopSlug;
        if (input.craftDescription !== undefined) {
          shopUpdateData['description'] = input.craftDescription;
          shopUpdateData['craftStory'] = input.craftDescription;
        }

        await this.databaseService.db
          .update(this.databaseService.schema.shops)
          .set(shopUpdateData)
          .where(eq(this.databaseService.schema.shops.id, existingShop.id));
      }
    }

    // 4. Upsert Pickup Address Draft if supplied
    if (input.pickupAddress) {
      const [existingAddress] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.pickupAddresses)
        .where(eq(this.databaseService.schema.pickupAddresses.sellerId, seller.id))
        .limit(1);

      if (!existingAddress) {
        if (
          input.pickupAddress.contactName &&
          input.pickupAddress.phone &&
          input.pickupAddress.addressLine1 &&
          input.pickupAddress.city &&
          input.pickupAddress.state &&
          input.pickupAddress.postalCode
        ) {
          await this.databaseService.db.insert(this.databaseService.schema.pickupAddresses).values({
            sellerId: seller.id,
            contactName: input.pickupAddress.contactName,
            phone: input.pickupAddress.phone,
            addressLine1: input.pickupAddress.addressLine1,
            addressLine2: input.pickupAddress.addressLine2 || null,
            city: input.pickupAddress.city,
            state: input.pickupAddress.state,
            postalCode: input.pickupAddress.postalCode,
            country: input.pickupAddress.country || 'IN',
          });
        }
      } else {
        const addressUpdateData: Record<string, unknown> = { updatedAt: new Date() };
        if (input.pickupAddress.contactName !== undefined)
          addressUpdateData['contactName'] = input.pickupAddress.contactName;
        if (input.pickupAddress.phone !== undefined)
          addressUpdateData['phone'] = input.pickupAddress.phone;
        if (input.pickupAddress.addressLine1 !== undefined)
          addressUpdateData['addressLine1'] = input.pickupAddress.addressLine1;
        if (input.pickupAddress.addressLine2 !== undefined)
          addressUpdateData['addressLine2'] = input.pickupAddress.addressLine2;
        if (input.pickupAddress.city !== undefined)
          addressUpdateData['city'] = input.pickupAddress.city;
        if (input.pickupAddress.state !== undefined)
          addressUpdateData['state'] = input.pickupAddress.state;
        if (input.pickupAddress.postalCode !== undefined)
          addressUpdateData['postalCode'] = input.pickupAddress.postalCode;
        if (input.pickupAddress.country !== undefined)
          addressUpdateData['country'] = input.pickupAddress.country;

        await this.databaseService.db
          .update(this.databaseService.schema.pickupAddresses)
          .set(addressUpdateData)
          .where(eq(this.databaseService.schema.pickupAddresses.id, existingAddress.id));
      }
    }

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'SELLER_DRAFT_SAVED',
      resourceType: 'SELLER',
      resourceId: seller.id,
    });

    return this.getOnboardingStatus(userId);
  }

  /**
   * Generates a pre-signed ticket for uploading a private verification KYC document.
   */
  async requestDocumentUpload(
    userId: string,
    input: PresignedDocumentRequestInput,
  ): Promise<PresignedDocumentUploadTicket> {
    this.storageService.validateDocumentConstraints(input.mimeType, input.fileSizeBytes);

    let [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) {
      const [newSeller] = await this.databaseService.db
        .insert(this.databaseService.schema.sellerProfiles)
        .values({
          userId,
          legalName: 'Pending Artisan Name',
          businessType: 'INDIVIDUAL',
          verificationStatus: 'DRAFT',
        })
        .returning();
      if (!newSeller)
        throw new InternalServerErrorException('Failed to create seller profile draft');
      seller = newSeller;
    }

    if (seller.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException('Cannot upload documents for a suspended seller profile');
    }

    const ticket = this.storageService.generateUploadTicket(seller.id, input);

    // Record document entry in PENDING state
    await this.databaseService.db.insert(this.databaseService.schema.sellerDocuments).values({
      id: ticket.documentId,
      sellerId: seller.id,
      documentType: input.documentType,
      storagePath: ticket.storagePath,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      status: 'PENDING',
    });

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'SELLER_DOCUMENT_UPLOAD_REQUESTED',
      resourceType: 'SELLER_DOCUMENT',
      resourceId: ticket.documentId,
      metadata: {
        documentType: input.documentType,
        fileName: input.fileName,
        fileSizeBytes: input.fileSizeBytes,
      },
    });

    return ticket;
  }

  /**
   * Confirms successful document upload completion.
   */
  async confirmDocumentUpload(userId: string, documentId: string) {
    const [seller] = await this.databaseService.db
      .select({ id: this.databaseService.schema.sellerProfiles.id })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) throw new NotFoundException('Seller profile not found');

    const [doc] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerDocuments)
      .where(
        and(
          eq(this.databaseService.schema.sellerDocuments.id, documentId),
          eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found or does not belong to this seller');

    return { success: true, message: 'Document upload confirmed and ready for compliance review' };
  }

  /**
   * Deletes a draft document prior to review.
   */
  async deleteDraftDocument(userId: string, documentId: string) {
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) throw new NotFoundException('Seller profile not found');

    if (seller.verificationStatus === 'VERIFIED') {
      throw new BadRequestException(
        'Cannot remove documents from an already approved seller profile',
      );
    }

    const [doc] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerDocuments)
      .where(
        and(
          eq(this.databaseService.schema.sellerDocuments.id, documentId),
          eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found');

    await this.databaseService.db
      .delete(this.databaseService.schema.sellerDocuments)
      .where(eq(this.databaseService.schema.sellerDocuments.id, documentId));

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'CUSTOMER',
      action: 'SELLER_DOCUMENT_REMOVED',
      resourceType: 'SELLER_DOCUMENT',
      resourceId: documentId,
    });

    return { success: true, message: 'Document removed from application' };
  }

  /**
   * Validates completeness, transitions application to PENDING_REVIEW, and assigns SELLER_APPLICANT role.
   */
  async submitApplication(userId: string, input: SellerApplicationSubmitInput) {
    // 1. Slug availability
    const [seller] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    const slugAvailability = await this.checkSlugAvailability(input.shopSlug, seller?.id);
    if (!slugAvailability.available) {
      throw new ConflictException(slugAvailability.message);
    }

    // 2. Ensure at least 1 document uploaded
    if (seller) {
      const documents = await this.databaseService.db
        .select({ id: this.databaseService.schema.sellerDocuments.id })
        .from(this.databaseService.schema.sellerDocuments)
        .where(eq(this.databaseService.schema.sellerDocuments.sellerId, seller.id));

      if (documents.length === 0) {
        throw new BadRequestException(
          'At least one proof of identity or artisan credential document must be uploaded before submission',
        );
      }
    } else {
      throw new BadRequestException(
        'Please upload at least one verification document before submitting your application',
      );
    }

    // 3. Status guard: cannot submit if already VERIFIED or PENDING_REVIEW
    if (seller.verificationStatus === 'VERIFIED') {
      throw new BadRequestException('Seller profile is already verified');
    }
    if (seller.verificationStatus === 'PENDING_REVIEW') {
      throw new BadRequestException('Application is already under compliance review');
    }
    if (seller.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException('Application cannot be submitted for a suspended seller');
    }

    const now = new Date();

    // 4. Atomic transaction updating profile, shop, pickup address, and role
    const [updatedSeller] = await this.databaseService.db
      .update(this.databaseService.schema.sellerProfiles)
      .set({
        legalName: input.legalName,
        businessType: input.businessType,
        taxId: input.taxId || null,
        verificationStatus: 'PENDING_REVIEW',
        submittedAt: now,
        termsAcceptedVersion: input.termsAcceptedVersion,
        termsAcceptedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.sellerProfiles.id, seller.id))
      .returning();

    if (!updatedSeller)
      throw new InternalServerErrorException('Failed to transition application state');

    // Upsert shop
    const [existingShop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
      .limit(1);

    if (!existingShop) {
      await this.databaseService.db.insert(this.databaseService.schema.shops).values({
        sellerId: seller.id,
        name: input.shopName,
        slug: input.shopSlug,
        description: input.craftDescription,
        craftStory: input.craftDescription,
      });
    } else {
      await this.databaseService.db
        .update(this.databaseService.schema.shops)
        .set({
          name: input.shopName,
          slug: input.shopSlug,
          description: input.craftDescription,
          craftStory: input.craftDescription,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.shops.id, existingShop.id));
    }

    // Upsert pickup address
    const [existingAddress] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.pickupAddresses)
      .where(eq(this.databaseService.schema.pickupAddresses.sellerId, seller.id))
      .limit(1);

    if (!existingAddress) {
      await this.databaseService.db.insert(this.databaseService.schema.pickupAddresses).values({
        sellerId: seller.id,
        contactName: input.pickupAddress.contactName,
        phone: input.pickupAddress.phone,
        addressLine1: input.pickupAddress.addressLine1,
        addressLine2: input.pickupAddress.addressLine2 || null,
        city: input.pickupAddress.city,
        state: input.pickupAddress.state,
        postalCode: input.pickupAddress.postalCode,
        country: input.pickupAddress.country,
      });
    } else {
      await this.databaseService.db
        .update(this.databaseService.schema.pickupAddresses)
        .set({
          contactName: input.pickupAddress.contactName,
          phone: input.pickupAddress.phone,
          addressLine1: input.pickupAddress.addressLine1,
          addressLine2: input.pickupAddress.addressLine2 || null,
          city: input.pickupAddress.city,
          state: input.pickupAddress.state,
          postalCode: input.pickupAddress.postalCode,
          country: input.pickupAddress.country,
          updatedAt: now,
        })
        .where(eq(this.databaseService.schema.pickupAddresses.id, existingAddress.id));
    }

    // Assign SELLER_APPLICANT role
    let [applicantRole] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.roles)
      .where(eq(this.databaseService.schema.roles.name, 'SELLER_APPLICANT'))
      .limit(1);

    if (!applicantRole) {
      [applicantRole] = await this.databaseService.db
        .insert(this.databaseService.schema.roles)
        .values({
          name: 'SELLER_APPLICANT',
          description: 'Artisan applicant under compliance review',
        })
        .returning();
    }

    if (applicantRole) {
      await this.databaseService.db
        .insert(this.databaseService.schema.userRoles)
        .values({
          userId,
          roleId: applicantRole.id,
          sellerId: seller.id,
        })
        .onConflictDoNothing();
    }

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'SELLER_APPLICANT',
      action: 'SELLER_APPLICATION_SUBMITTED',
      resourceType: 'SELLER',
      resourceId: seller.id,
      metadata: {
        legalName: input.legalName,
        businessType: input.businessType,
        shopSlug: input.shopSlug,
        termsVersion: input.termsAcceptedVersion,
      },
    });

    return {
      sellerId: seller.id,
      status: 'PENDING_REVIEW',
      submittedAt: now.toISOString(),
    };
  }

  /**
   * Retrieves shop details for authenticated seller.
   */
  async getSellerShop(userId: string) {
    const [seller] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.sellerProfiles.id,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
      })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) throw new NotFoundException('Seller profile not found');

    const [shop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
      .limit(1);

    if (!shop) throw new NotFoundException('Shop profile not found');

    return {
      shopId: shop.id,
      sellerId: seller.id,
      shopName: shop.name,
      shopSlug: shop.slug,
      status: seller.verificationStatus,
      description: shop.description,
      craftStory: shop.craftStory,
      logoUrl: shop.logoUrl,
      bannerUrl: shop.bannerUrl,
      ratingAverage: shop.ratingAverage,
      ratingCount: shop.ratingCount,
      isVacationMode: shop.isVacationMode,
    };
  }
}
