export interface CategoryDto {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  commissionRateBps?: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductMediaDto {
  id: string;
  productId: string;
  variantId?: string | null;
  mediaType: string;
  url: string;
  thumbnailUrl?: string | null;
  altText?: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ProductVariantInventoryDto {
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  isUnlimited: boolean;
  lowStockThreshold: number;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  title: string;
  priceMinor: number;
  currency: string;
  compareAtPriceMinor?: number | null;
  weightGrams: number;
  dimensionLengthMm: number;
  dimensionWidthMm: number;
  dimensionHeightMm: number;
  attributes: Record<string, string>;
  isActive: boolean;
  inventory?: ProductVariantInventoryDto;
}

export interface ProductSummaryDto {
  id: string;
  sellerId: string;
  title: string;
  slug: string;
  productType: string;
  basePriceMinor: number;
  currency: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  primaryImageUrl?: string | null;
  moderationStatus: string;
  isActive: boolean;
  totalStock: number;
  createdAt: string;
  publishedAt?: string | null;
}

export interface ProductDetailDto {
  id: string;
  sellerId: string;
  shop?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  productType: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  description: string;
  basePriceMinor: number;
  currency: string;
  moderationStatus: string;
  rejectionReason?: string | null;
  isActive: boolean;
  isFragile: boolean;
  isCustomizable: boolean;
  customizationInstructions?: string | null;
  productionLeadTimeDays: number;
  materials: string[];
  techniques: string[];
  careInstructions?: string | null;
  countryOfOrigin: string;
  media: ProductMediaDto[];
  variants: ProductVariantDto[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface StockAdjustmentResultDto {
  variantId: string;
  previousOnHand: number;
  newOnHand: number;
  quantityDelta: number;
  reason: string;
  notes?: string | null;
  adjustedAt: string;
}

export interface ProductModerationDecisionDto {
  productId: string;
  decision: string;
  moderationStatus: string;
  reasonCode: string;
  notes?: string | null;
  moderatedAt: string;
}

export interface PresignedProductMediaUploadTicket {
  mediaId: string;
  storagePath: string;
  presignedUploadUrl: string;
  expiresInSeconds: number;
}
