import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

export const SELLER_BUSINESS_TYPES = [
  'INDIVIDUAL',
  'SOLE_PROPRIETORSHIP',
  'REGISTERED_COMPANY',
] as const;

export const sellerBusinessTypeSchema = z.enum(SELLER_BUSINESS_TYPES);
export type SellerBusinessType = z.infer<typeof sellerBusinessTypeSchema>;

export const SELLER_VERIFICATION_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;

export const sellerVerificationStatusSchema = z.enum(SELLER_VERIFICATION_STATUSES);
export type SellerVerificationStatus = z.infer<typeof sellerVerificationStatusSchema>;

export const SELLER_DOCUMENT_TYPES = [
  'GOVERNMENT_ID',
  'TAX_CERTIFICATE',
  'BANK_PROOF',
  'ARTISAN_CERTIFICATE',
] as const;

export const sellerDocumentTypeSchema = z.enum(SELLER_DOCUMENT_TYPES);
export type SellerDocumentType = z.infer<typeof sellerDocumentTypeSchema>;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const allowedDocumentMimeTypeSchema = z.enum(ALLOWED_DOCUMENT_MIME_TYPES);

export const shopSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'Shop slug must be at least 3 characters' })
  .max(100, { message: 'Shop slug cannot exceed 100 characters' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Shop slug must be lowercase alphanumeric characters separated by single hyphens',
  });

export const pickupAddressSchema = z.object({
  contactName: z.string().trim().min(2, { message: 'Contact name is required' }).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, { message: 'Contact phone must follow E.164 format' }),
  addressLine1: z.string().trim().min(5, { message: 'Street address line 1 is required' }).max(255),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(2, { message: 'City is required' }).max(100),
  state: z.string().trim().min(2, { message: 'State or Province is required' }).max(100),
  postalCode: z.string().trim().min(4, { message: 'Postal/ZIP code is required' }).max(20),
  country: z
    .string()
    .trim()
    .length(2, { message: 'Country must be a 2-letter ISO code' })
    .default('IN'),
});

export type PickupAddressInput = z.infer<typeof pickupAddressSchema>;

export const saveDraftSellerSchema = z.object({
  legalName: z.string().trim().max(255).optional(),
  businessType: sellerBusinessTypeSchema.optional(),
  taxId: z.string().trim().max(100).optional(),
  shopName: z.string().trim().max(100).optional(),
  shopSlug: shopSlugSchema.optional(),
  craftDescription: z.string().trim().max(2000).optional(),
  pickupAddress: pickupAddressSchema.partial().optional(),
});

export type SaveDraftSellerInput = z.infer<typeof saveDraftSellerSchema>;

export const sellerApplicationSubmitSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, { message: 'Legal business or artisan name is required' })
    .max(255),
  businessType: sellerBusinessTypeSchema,
  taxId: z.string().trim().max(100).optional(),
  shopName: z.string().trim().min(2, { message: 'Shop name is required' }).max(100),
  shopSlug: shopSlugSchema,
  craftDescription: z
    .string()
    .trim()
    .min(10, {
      message: 'Please provide at least a brief (10+ characters) description of your craft',
    })
    .max(2000),
  pickupAddress: pickupAddressSchema,
  termsAcceptedVersion: z
    .string()
    .trim()
    .min(1, { message: 'Seller terms acceptance version is required' }),
});

export type SellerApplicationSubmitInput = z.infer<typeof sellerApplicationSubmitSchema>;

export const presignedDocumentRequestSchema = z.object({
  documentType: sellerDocumentTypeSchema,
  fileName: z
    .string()
    .trim()
    .min(3, { message: 'File name is required' })
    .max(255)
    .regex(/^[^\\/:\*\?"<>\|]+$/, { message: 'File name contains invalid characters' }),
  mimeType: allowedDocumentMimeTypeSchema,
  fileSizeBytes: z
    .number()
    .int()
    .positive({ message: 'File size must be greater than 0' })
    .max(10485760, { message: 'Document size cannot exceed 10 MB' }),
});

export type PresignedDocumentRequestInput = z.infer<typeof presignedDocumentRequestSchema>;

export const adminReviewSellerSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED', 'ACTION_REQUIRED']),
    reasonNotes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (
        (data.decision === 'REJECTED' || data.decision === 'ACTION_REQUIRED') &&
        (!data.reasonNotes || data.reasonNotes.length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'A detailed reason (at least 5 characters) is required when rejecting or requesting additional action',
      path: ['reasonNotes'],
    },
  );

export type AdminReviewSellerInput = z.infer<typeof adminReviewSellerSchema>;

export const adminSuspendSellerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, { message: 'Suspension reason of at least 5 characters is required' }),
});

export type AdminSuspendSellerInput = z.infer<typeof adminSuspendSellerSchema>;

export const listSellerApplicationsQuerySchema = paginationQuerySchema.extend({
  status: sellerVerificationStatusSchema.optional(),
  businessType: sellerBusinessTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListSellerApplicationsQuery = z.infer<typeof listSellerApplicationsQuerySchema>;
