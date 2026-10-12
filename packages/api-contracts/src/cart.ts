export interface CartItemDto {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  primaryImageUrl?: string | null;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  customizationText?: string | null;
  availableStock: number;
  isAvailable: boolean;
  priceChanged: boolean;
  originalPriceMinor?: number;
  sellerId: string;
  shopName: string;
  shopSlug: string;
}

export interface CartSellerGroupDto {
  sellerId: string;
  shopName: string;
  shopSlug: string;
  items: CartItemDto[];
  subtotalMinor: number;
  shippingFeeMinor: number;
}

export interface CartDto {
  id: string;
  customerId?: string | null;
  sessionId?: string | null;
  currency: string;
  itemsCount: number;
  subtotalMinor: number;
  estimatedShippingMinor: number;
  totalEstimatedMinor: number;
  sellerGroups: CartSellerGroupDto[];
  hasUnavailableItems: boolean;
  hasPriceChanges: boolean;
  expiresAt: string;
  updatedAt: string;
}
