import { describe, it, expect } from 'vitest';
import {
  shopSlugSchema,
  sellerApplicationSubmitSchema,
  adminReviewSellerSchema,
  presignedDocumentRequestSchema,
} from '../src/seller.js';

describe('Seller Onboarding Validation Schemas', () => {
  it('validates shop slugs according to kebab-case format', () => {
    expect(shopSlugSchema.safeParse('clay-creations').success).toBe(true);
    expect(shopSlugSchema.safeParse('kerala-woodcraft-101').success).toBe(true);
    // Uppercase converted to lowercase
    const upperResult = shopSlugSchema.safeParse('POTTERY-STUDIO');
    expect(upperResult.success).toBe(true);
    if (upperResult.success) {
      expect(upperResult.data).toBe('pottery-studio');
    }

    // Invalid symbols
    expect(shopSlugSchema.safeParse('shop_name').success).toBe(false);
    expect(shopSlugSchema.safeParse('-leading-dash').success).toBe(false);
    expect(shopSlugSchema.safeParse('trailing-dash-').success).toBe(false);
    expect(shopSlugSchema.safeParse('double--dash').success).toBe(false);
    expect(shopSlugSchema.safeParse('ab').success).toBe(false); // too short
  });

  it('validates seller submission with complete requirements', () => {
    const valid = {
      legalName: 'Indira Sharma',
      businessType: 'INDIVIDUAL',
      taxId: 'ABCDE1234F',
      shopName: 'Indira Terracotta Arts',
      shopSlug: 'indira-terracotta',
      craftDescription: 'Hand-thrown traditional terracotta cookware and home planters.',
      pickupAddress: {
        contactName: 'Indira Sharma',
        phone: '+919876543210',
        addressLine1: '42 Artisan Lane, Kumhar Gram',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'IN',
      },
      termsAcceptedVersion: 'v1.0',
    };

    expect(sellerApplicationSubmitSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects seller submission missing craft description or terms', () => {
    const invalid = {
      legalName: 'Indira Sharma',
      businessType: 'INDIVIDUAL',
      shopName: 'Indira Terracotta Arts',
      shopSlug: 'indira-terracotta',
      craftDescription: 'Short', // Less than 10 characters
      pickupAddress: {
        contactName: 'Indira Sharma',
        phone: '+919876543210',
        addressLine1: '42 Artisan Lane',
        city: 'Jaipur',
        state: 'Rajasthan',
        postalCode: '302001',
        country: 'IN',
      },
      termsAcceptedVersion: '',
    };

    expect(sellerApplicationSubmitSchema.safeParse(invalid).success).toBe(false);
  });

  it('enforces mandatory reason notes when admin rejects or requests action', () => {
    // Approved without notes is fine
    expect(adminReviewSellerSchema.safeParse({ decision: 'APPROVED' }).success).toBe(true);

    // Rejected without notes must fail
    expect(adminReviewSellerSchema.safeParse({ decision: 'REJECTED' }).success).toBe(false);

    // Rejected with notes succeeds
    expect(
      adminReviewSellerSchema.safeParse({
        decision: 'REJECTED',
        reasonNotes: 'Government ID document unreadable; please upload a clear scanned color PDF.',
      }).success,
    ).toBe(true);
  });

  it('validates document upload specifications and size limits', () => {
    const validDoc = {
      documentType: 'GOVERNMENT_ID',
      fileName: 'aadhaar_front.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048000, // 2 MB
    };
    expect(presignedDocumentRequestSchema.safeParse(validDoc).success).toBe(true);

    // Oversized (>10MB) rejected
    const oversizedDoc = {
      documentType: 'GOVERNMENT_ID',
      fileName: 'huge.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 15000000,
    };
    expect(presignedDocumentRequestSchema.safeParse(oversizedDoc).success).toBe(false);

    // Unsupported MIME rejected
    const executableDoc = {
      documentType: 'GOVERNMENT_ID',
      fileName: 'script.exe',
      mimeType: 'application/x-msdownload',
      fileSizeBytes: 1024,
    };
    expect(presignedDocumentRequestSchema.safeParse(executableDoc).success).toBe(false);
  });
});
