import type { PaginationMeta } from './response.js';

export interface AdminDashboardMetricsDto {
  sellers: {
    total: number;
    pendingVerification: number;
    approved: number;
    suspended: number;
  };
  products: {
    total: number;
    pendingModeration: number;
    published: number;
    rejected: number;
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
    grossMerchandiseValueMinor: number;
  };
  fulfilment: {
    totalShipments: number;
    pendingPickup: number;
    inTransit: number;
    delivered: number;
    deliveryExceptions: number;
  };
  finances: {
    capturedPaymentsMinor: number;
    platformCommissionsMinor: number;
    sellerPayablesMinor: number;
    reconciliationDiscrepancies: number;
  };
  recentAuditLogs: AdminAuditLogListItemDto[];
}

export interface AdminOrderListItemDto {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmountMinor: number;
  subOrderCount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderSubOrderItemDto {
  id: string;
  productId: string;
  productTitle: string;
  variantId?: string | null;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  totalPriceMinor: number;
  customisationNote?: string | null;
}

export interface AdminOrderSubOrderDto {
  id: string;
  subOrderNumber: string;
  sellerId: string;
  sellerLegalName: string;
  shopName: string;
  subOrderStatus: string;
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  commissionFeeMinor: number;
  taxMinor: number;
  netArtisanPayableMinor: number;
  payoutStatus: string;
  items: AdminOrderSubOrderItemDto[];
  shipment?: {
    id: string;
    waybillNumber?: string | null;
    trackingNumber?: string | null;
    carrier: string;
    status: string;
    pickupDate?: string | null;
  } | null;
}

export interface AdminOrderDetailDto extends AdminOrderListItemDto {
  shippingAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  subOrders: AdminOrderSubOrderDto[];
  payment?: {
    id: string;
    provider: string;
    providerOrderId: string;
    amountMinor: number;
    currency: string;
    status: string;
    paymentMethod?: string | null;
    capturedAt?: string | null;
  } | null;
}

export interface AdminShipmentListItemDto {
  id: string;
  waybillNumber?: string | null;
  trackingNumber?: string | null;
  carrier: string;
  status: string;
  subOrderId: string;
  subOrderNumber: string;
  sellerId: string;
  sellerName: string;
  shopName: string;
  destinationCity: string;
  destinationPincode: string;
  pickupDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShipmentDetailDto extends AdminShipmentListItemDto {
  packageWeightGrams: number;
  dimensions: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  pickupAddressSnapshot: Record<string, unknown>;
  deliveryAddressSnapshot: Record<string, unknown>;
  trackingEvents: Array<{
    status: string;
    location?: string;
    timestamp: string;
    description: string;
    rawCourierStatus?: string;
  }>;
  cancellationReason?: string | null;
  carrierMetadata?: Record<string, unknown> | null;
}

export interface AdminAuditLogListItemDto {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AdminAuditLogDetailDto extends AdminAuditLogListItemDto {
  userAgent?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminStaffUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAdminOrdersDto {
  items: AdminOrderListItemDto[];
  meta: PaginationMeta;
}

export interface PaginatedAdminShipmentsDto {
  items: AdminShipmentListItemDto[];
  meta: PaginationMeta;
}

export interface PaginatedAdminAuditLogsDto {
  items: AdminAuditLogListItemDto[];
  meta: PaginationMeta;
}

export interface PaginatedAdminStaffDto {
  items: AdminStaffUserDto[];
  meta: PaginationMeta;
}
