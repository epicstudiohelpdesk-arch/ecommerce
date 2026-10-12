import { describe, it, expect } from 'vitest';
import {
  createProductDraftSchema,
  productVariantInputSchema,
  stockAdjustmentSchema,
  adminModerateProductSchema,
  presignedProductMediaRequestSchema,
  productSlugSchema,
} from '../src/catalog.js';

describe('Catalog Validation Schemas', () => {
  it('validates a correct product draft input', () => {
    const valid = {
      title: 'Hand-Carved Teak Wood Bowl',
      shortDescription: 'Organic hand-turned salad bowl',
      description:
        'Handcrafted from seasoned plantation teak with natural linseed oil food-safe polish.',
      categoryId: '11111111-1111-1111-1111-111111111111',
      productType: 'READY_TO_SHIP',
      basePriceMinor: 249900,
      currency: 'INR',
      materials: ['Teak Wood', 'Linseed Oil'],
      techniques: ['Woodturning', 'Hand-polishing'],
      productionLeadTimeDays: 2,
      countryOfOrigin: 'IN',
    };

    const result = createProductDraftSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects product draft with negative price or short title', () => {
    const invalid = {
      title: 'Hi',
      description: 'Too short',
      categoryId: '11111111-1111-1111-1111-111111111111',
      productType: 'READY_TO_SHIP',
      basePriceMinor: -500,
    };

    const result = createProductDraftSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('title'))).toBe(true);
      expect(result.error.issues.some((i) => i.path.includes('basePriceMinor'))).toBe(true);
    }
  });

  it('validates variant input with positive dimensions and weight', () => {
    const variant = {
      sku: 'TEAK-BOWL-MED',
      title: 'Medium 8-inch',
      priceMinor: 249900,
      weightGrams: 450,
      dimensions: {
        lengthMm: 200,
        widthMm: 200,
        heightMm: 75,
      },
      initialStock: 10,
    };

    const result = productVariantInputSchema.safeParse(variant);
    expect(result.success).toBe(true);
  });

  it('rejects variant with non-positive weight or dimensions', () => {
    const invalidVariant = {
      sku: 'BAD-VAR',
      title: 'Invalid',
      priceMinor: 1000,
      weightGrams: 0,
      dimensions: {
        lengthMm: 0,
        widthMm: 100,
        heightMm: 50,
      },
    };

    const result = productVariantInputSchema.safeParse(invalidVariant);
    expect(result.success).toBe(false);
  });

  it('validates stock adjustment with non-zero delta', () => {
    const valid = {
      variantId: '22222222-2222-2222-2222-222222222222',
      quantityDelta: -2,
      reason: 'BREAKAGE',
      notes: 'Damaged in kiln cooling cycle',
    };

    const result = stockAdjustmentSchema.safeParse(valid);
    expect(result.success).toBe(true);

    const zeroDelta = {
      ...valid,
      quantityDelta: 0,
    };
    expect(stockAdjustmentSchema.safeParse(zeroDelta).success).toBe(false);
  });

  it('enforces detailed notes when rejecting or suspending listing in admin moderation', () => {
    const rejectionWithoutNotes = {
      decision: 'REJECTED',
      reasonCode: 'MASS_MANUFACTURED',
    };
    expect(adminModerateProductSchema.safeParse(rejectionWithoutNotes).success).toBe(false);

    const validRejection = {
      decision: 'REJECTED',
      reasonCode: 'MASS_MANUFACTURED',
      notes: 'Product photographs match factory wholesale catalogue items.',
    };
    expect(adminModerateProductSchema.safeParse(validRejection).success).toBe(true);

    const validApproval = {
      decision: 'APPROVED',
      reasonCode: 'VERIFIED_HANDMADE',
    };
    expect(adminModerateProductSchema.safeParse(validApproval).success).toBe(true);
  });

  it('validates product slug formatting', () => {
    expect(productSlugSchema.safeParse('handcrafted-terracotta-vase-2026').success).toBe(true);
    expect(productSlugSchema.safeParse('Invalid Slug!').success).toBe(false);
    expect(productSlugSchema.safeParse('slug--double-dash').success).toBe(false);
  });

  it('enforces media upload constraints (MIME and size)', () => {
    expect(
      presignedProductMediaRequestSchema.safeParse({
        fileName: 'vase_main.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024 * 1024,
      }).success,
    ).toBe(true);

    expect(
      presignedProductMediaRequestSchema.safeParse({
        fileName: 'exploit.exe',
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1024,
      }).success,
    ).toBe(false);
  });
});
