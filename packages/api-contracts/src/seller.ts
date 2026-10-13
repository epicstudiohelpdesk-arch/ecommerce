export interface SellerOnboardingStatus {
  hasProfile: boolean;
  sellerId?: string;
  verificationStatus: 'DRAFT' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  profile?: {
    legalName: string;
    businessType: string;
    taxId?: string | null;
    rejectionReason?: string | null;
    submittedAt?: string | null;
    verifiedAt?: string | null;
  };
  shop?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    craftStory?: string | null;
    logoUrl?: string | null;
  };
  pickupAddress?: {
    contactName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    reviewNotes?: string | null;
    createdAt: string;
  }>;
  missingFields: string[];
  canSubmit: boolean;
}

export interface SellerEligibility {
  sellerId: string;
  isEligibleToSell: boolean;
  canPublishProducts: boolean;
  canReceivePayouts: boolean;
  verificationStatus: string;
  reason?: string;
}

export interface PresignedDocumentUploadTicket {
  documentId: string;
  storagePath: string;
  presignedUploadUrl: string;
  expiresInSeconds: number;
}

export interface SellerApplicationDetail {
  sellerId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  legalName: string;
  businessType: string;
  taxId?: string | null;
  verificationStatus: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  termsAcceptedVersion?: string | null;
  termsAcceptedAt?: string | null;
  shop?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    craftStory?: string | null;
    logoUrl?: string | null;
  } | null;
  pickupAddress?: {
    contactName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    status: string;
    reviewNotes?: string | null;
    downloadUrl: string;
    createdAt: string;
  }>;
}

export interface SellerApplicationSummary {
  sellerId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  legalName: string;
  businessType: string;
  shopName: string;
  shopSlug: string;
  verificationStatus: string;
  documentCount: number;
  submittedAt?: string | null;
  createdAt: string;
}

// --- G10: Seller Studio DTOs ---

export interface SellerActionItemDto {
  id: string;
  type:
    | 'VERIFICATION_PENDING'
    | 'REJECTED_PRODUCT'
    | 'UNPROCESSED_ORDER'
    | 'LOW_STOCK'
    | 'VACATION_ACTIVE';
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
}

export interface SellerRecentActivityDto {
  id: string;
  type: 'ORDER_RECEIVED' | 'ORDER_STATUS_CHANGED' | 'PRODUCT_REVIEWED' | 'STOCK_ADJUSTED';
  title: string;
  description: string;
  timestamp: string;
  referenceId?: string;
}

export interface SellerDashboardDto {
  metrics: {
    ordersCount: number;
    actionRequiredOrdersCount: number;
    grossSalesMinor: number;
    netPayableMinor: number;
    publishedProductsCount: number;
    pendingReviewProductsCount: number;
    lowStockVariantsCount: number;
    outOfStockVariantsCount: number;
  };
  financialPosition: {
    pendingEscrowMinor: number;
    availablePayoutMinor: number;
    heldDisputeMinor: number;
    lifetimePayoutMinor: number;
    currency: string;
  };
  actionItems: SellerActionItemDto[];
  recentActivity: SellerRecentActivityDto[];
  period: string;
  timeZone: string;
}

export interface SellerSubOrderItemDto {
  id: string;
  variantId: string;
  titleSnapshot: string;
  skuSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  totalPriceMinor: number;
  customizationInput?: string | null;
}

export interface SellerSubOrderSummaryDto {
  id: string;
  subOrderNumber: string;
  parentOrderNumber: string;
  status: string;
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  commissionFeeMinor: number;
  netSellerPayableMinor: number;
  currency: string;
  createdAt: string;
  parentPaymentStatus: string;
  itemCount: number;
  recipientCity: string;
  recipientState: string;
  recipientPostalCode: string;
}

export interface SellerSubOrderDetailDto {
  id: string;
  subOrderNumber: string;
  parentOrderNumber: string;
  status: string;
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  commissionFeeMinor: number;
  netSellerPayableMinor: number;
  currency: string;
  createdAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  completedAt?: string | null;
  parentPaymentStatus: string;
  parentOrderStatus: string;
  customerNote?: string | null;
  shippingAddress: {
    recipientName: string;
    line1?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: SellerSubOrderItemDto[];
  timeline: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    notes?: string | null;
    createdAt: string;
  }>;
}

export interface SellerSubOrderListResponseDto {
  items: SellerSubOrderSummaryDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SellerSalesTrendPointDto {
  date: string;
  ordersCount: number;
  grossSalesMinor: number;
  netPayableMinor: number;
}

export interface SellerTopProductDto {
  variantId: string;
  title: string;
  sku: string;
  unitsSold: number;
  totalRevenueMinor: number;
}

export interface SellerAnalyticsPerformanceDto {
  period: string;
  summary: {
    totalOrders: number;
    grossSalesMinor: number;
    netPayableMinor: number;
    commissionPaidMinor: number;
    averageOrderValueMinor: number;
    cancellationRateBps: number;
    completedOrdersCount: number;
    currency: string;
  };
  salesTrend: SellerSalesTrendPointDto[];
  topProducts: SellerTopProductDto[];
}

export interface SellerNotificationDto {
  id: string;
  type: 'ORDER' | 'STOCK' | 'PRODUCT' | 'ACCOUNT';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actionUrl?: string;
}

export interface ShopProfileDto {
  shopId: string;
  sellerId: string;
  shopName: string;
  shopSlug: string;
  status: string;
  description?: string | null;
  craftStory?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  ratingAverage: number;
  ratingCount: number;
  isVacationMode: boolean;
  vacationMessage?: string | null;
}
