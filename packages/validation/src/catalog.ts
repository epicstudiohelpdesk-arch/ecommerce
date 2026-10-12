import { z } from 'zod';
import { uuidSchema, paginationQuerySchema } from './common.js';

export const PRODUCT_TYPES = [
  'READY_TO_SHIP',
  'ONE_OF_A_KIND',
  'MADE_TO_ORDER',
  'PERSONALIZED',
] as const;

export const productTypeSchema = z.enum(PRODUCT_TYPES);
export type ProductType = z.infer<typeof productTypeSchema>;

export const PRODUCT_MODERATION_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
  'SUSPENDED',
] as const;

export const productModerationStatusSchema = z.enum(PRODUCT_MODERATION_STATUSES);
export type ProductModerationStatus = z.infer<typeof productModerationStatusSchema>;

export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'Product slug must be at least 3 characters' })
  .max(255, { message: 'Product slug cannot exceed 255 characters' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Product slug must be lowercase alphanumeric characters separated by single hyphens',
  });

export const productDimensionsSchema = z.object({
  lengthMm: z.number().int().positive({ message: 'Length must be greater than 0 mm' }),
  widthMm: z.number().int().positive({ message: 'Width must be greater than 0 mm' }),
  heightMm: z.number().int().positive({ message: 'Height must be greater than 0 mm' }),
});

export type ProductDimensions = z.infer<typeof productDimensionsSchema>;

export const productVariantInputSchema = z.object({
  id: uuidSchema.optional(),
  sku: z
    .string()
    .trim()
    .min(3, { message: 'SKU must be at least 3 characters' })
    .max(100, { message: 'SKU cannot exceed 100 characters' }),
  title: z.string().trim().min(1, { message: 'Variant title is required' }).max(150),
  priceMinor: z.number().int().min(0, { message: 'Variant price cannot be negative' }),
  compareAtPriceMinor: z.number().int().min(0).optional().nullable(),
  weightGrams: z.number().int().positive({ message: 'Weight must be greater than 0 grams' }),
  dimensions: productDimensionsSchema,
  attributes: z.record(z.string(), z.string()).optional().default({}),
  initialStock: z.number().int().min(0, { message: 'Initial stock cannot be negative' }).default(0),
  isUnlimited: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

export const createProductDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: 'Product title must be at least 3 characters' })
    .max(255, { message: 'Product title cannot exceed 255 characters' }),
  shortDescription: z.string().trim().max(500).optional(),
  description: z
    .string()
    .trim()
    .min(10, { message: 'Detailed product description must be at least 10 characters' })
    .max(10000),
  categoryId: uuidSchema,
  productType: productTypeSchema,
  basePriceMinor: z
    .number()
    .int()
    .min(0, { message: 'Base price must be a non-negative integer in minor currency units' }),
  currency: z.string().trim().length(3).default('INR'),
  isFragile: z.boolean().default(false),
  isCustomizable: z.boolean().default(false),
  customizationInstructions: z.string().trim().max(1000).optional().nullable(),
  productionLeadTimeDays: z
    .number()
    .int()
    .min(0, { message: 'Lead time cannot be negative' })
    .default(0),
  materials: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  techniques: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  careInstructions: z.string().trim().max(1000).optional().nullable(),
  countryOfOrigin: z.string().trim().length(2).default('IN'),
  variants: z.array(productVariantInputSchema).optional(),
});

export type CreateProductDraftInput = z.infer<typeof createProductDraftSchema>;

export const updateProductSchema = createProductDraftSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const presignedProductMediaRequestSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(3, { message: 'File name is required' })
    .max(255)
    .regex(/^[^\\/:\*\?"<>\|]+$/, { message: 'File name contains invalid characters' }),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Allowed image formats: JPEG, PNG, WEBP',
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive({ message: 'File size must be greater than 0' })
    .max(10485760, { message: 'Image size cannot exceed 10 MB' }),
});

export type PresignedProductMediaRequestInput = z.infer<typeof presignedProductMediaRequestSchema>;

export const productMediaOrderSchema = z.object({
  mediaId: uuidSchema,
  displayOrder: z.number().int().min(0),
  isPrimary: z.boolean().default(false),
});

export type ProductMediaOrderInput = z.infer<typeof productMediaOrderSchema>;

export const reorderProductMediaSchema = z.array(productMediaOrderSchema);
export type ReorderProductMediaInput = z.infer<typeof reorderProductMediaSchema>;

export const attachProductMediaSchema = z.object({
  url: z.string().trim().min(1, { message: 'Media URL is required' }),
  thumbnailUrl: z.string().trim().optional(),
  altText: z.string().trim().max(255).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
  variantId: uuidSchema.optional(),
});

export type AttachProductMediaInput = z.infer<typeof attachProductMediaSchema>;

export const STOCK_ADJUSTMENT_REASONS = [
  'MANUAL_CORRECTION',
  'RECEIPT',
  'BREAKAGE',
  'SALE_COMMITTED',
  'RETURN_RESTOCK',
  'AUDIT_DISCREPANCY',
] as const;

export const stockAdjustmentReasonSchema = z.enum(STOCK_ADJUSTMENT_REASONS);
export type StockAdjustmentReason = z.infer<typeof stockAdjustmentReasonSchema>;

export const stockAdjustmentSchema = z.object({
  variantId: uuidSchema,
  quantityDelta: z
    .number()
    .int()
    .refine((val) => val !== 0, { message: 'Quantity delta cannot be zero' }),
  reason: stockAdjustmentReasonSchema,
  notes: z.string().trim().max(500).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const listSellerProductsQuerySchema = paginationQuerySchema.extend({
  status: productModerationStatusSchema.optional(),
  categoryId: uuidSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListSellerProductsQuery = z.infer<typeof listSellerProductsQuerySchema>;

export const listPublicCatalogQuerySchema = paginationQuerySchema.extend({
  categorySlug: z.string().trim().optional(),
  productType: productTypeSchema.optional(),
  minPriceMinor: z.coerce.number().int().min(0).optional(),
  maxPriceMinor: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'title_asc']).default('newest').optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListPublicCatalogQuery = z.infer<typeof listPublicCatalogQuerySchema>;

export const adminModerateProductSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
    reasonCode: z.string().trim().min(2, { message: 'Reason code is required' }).max(100),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (
        (data.decision === 'REJECTED' || data.decision === 'SUSPENDED') &&
        (!data.notes || data.notes.length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'A detailed note of at least 5 characters is required when rejecting or suspending a listing',
      path: ['notes'],
    },
  );

export type AdminModerateProductInput = z.infer<typeof adminModerateProductSchema>;
