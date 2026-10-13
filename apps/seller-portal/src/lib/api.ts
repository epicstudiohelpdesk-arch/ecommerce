import type {
  SellerDashboardDto,
  SellerSubOrderListResponseDto,
  SellerSubOrderDetailDto,
  SellerSubOrderSummaryDto,
  SellerAnalyticsPerformanceDto,
  SellerNotificationDto,
  ShopProfileDto,
  ShipmentDto,
  BookShipmentResponseDto,
  ShippingLabelDto,
  SchedulePickupResponseDto,
  CancelShipmentResponseDto,
} from '@repo/api-contracts';
import type {
  UpdateSubOrderStatusInput,
  UpdateShopProfileInput,
  ListSellerOrdersQuery,
  BookShipmentInput,
  SchedulePickupInput,
  CancelShipmentInput,
} from '@repo/validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// Fallback data for preview/development when backend session is not established
const FALLBACK_DASHBOARD: SellerDashboardDto = {
  period: '7d',
  timeZone: 'Asia/Kolkata',
  metrics: {
    ordersCount: 24,
    actionRequiredOrdersCount: 5,
    grossSalesMinor: 2845000,
    netPayableMinor: 2418250,
    publishedProductsCount: 18,
    pendingReviewProductsCount: 2,
    lowStockVariantsCount: 3,
    outOfStockVariantsCount: 1,
  },
  financialPosition: {
    pendingEscrowMinor: 890000,
    availablePayoutMinor: 1528250,
    heldDisputeMinor: 0,
    lifetimePayoutMinor: 14250000,
    currency: 'INR',
  },
  actionItems: [
    {
      id: 'act-1',
      type: 'UNPROCESSED_ORDER',
      severity: 'HIGH',
      title: '5 Orders Awaiting Production or Packing',
      description: 'Handcrafted items need to be crafted or marked ready for courier pickup.',
      actionLabel: 'Fulfill Orders',
      actionUrl: '/orders?status=CONFIRMED',
    },
    {
      id: 'act-2',
      type: 'LOW_STOCK',
      severity: 'MEDIUM',
      title: '3 Listings Running Low on Stock',
      description: 'Chai cups and terracotta planters are at or below threshold.',
      actionLabel: 'Manage Stock',
      actionUrl: '/inventory',
    },
    {
      id: 'act-3',
      type: 'VACATION_ACTIVE',
      severity: 'INFO',
      title: 'Shop is currently OPEN to new orders',
      description: 'Taking time off for craft exhibitions? Enable vacation mode anytime.',
      actionLabel: 'Shop Settings',
      actionUrl: '/shop',
    },
  ],
  recentActivity: [
    {
      id: 'rec-1',
      type: 'ORDER_RECEIVED',
      title: 'New Custom Order Placed: SUB-2026-9812',
      description: 'Customer purchased 1 Glazed Stoneware Serving Bowl',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      referenceId: 'SUB-2026-9812',
    },
    {
      id: 'rec-2',
      type: 'ORDER_STATUS_CHANGED',
      title: 'Order SUB-2026-9801 moved to IN_PRODUCTION',
      description: 'Artisan started throwing and firing batch',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      referenceId: 'SUB-2026-9801',
    },
    {
      id: 'rec-3',
      type: 'STOCK_ADJUSTED',
      title: 'Stock Updated: Terracotta Chai Cups (+12)',
      description: 'Fresh batch fired from kiln and added to inventory',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      referenceId: 'POT-CHAI-SET6',
    },
  ],
};

const FALLBACK_ORDER_SUMMARIES: SellerSubOrderSummaryDto[] = [
  {
    id: 'sub-ord-101',
    subOrderNumber: 'SUB-2026-9812',
    parentOrderNumber: 'ORD-2026-4401',
    status: 'CONFIRMED',
    itemSubtotalMinor: 175000,
    shippingFeeMinor: 15000,
    commissionFeeMinor: 26250,
    netSellerPayableMinor: 163750,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    itemCount: 1,
    recipientCity: 'Bengaluru',
    recipientState: 'Karnataka',
    recipientPostalCode: '560038',
  },
  {
    id: 'sub-ord-102',
    subOrderNumber: 'SUB-2026-9801',
    parentOrderNumber: 'ORD-2026-4395',
    status: 'IN_PRODUCTION',
    itemSubtotalMinor: 178000,
    shippingFeeMinor: 12000,
    commissionFeeMinor: 26700,
    netSellerPayableMinor: 163300,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    itemCount: 2,
    recipientCity: 'Mumbai',
    recipientState: 'Maharashtra',
    recipientPostalCode: '400050',
  },
  {
    id: 'sub-ord-103',
    subOrderNumber: 'SUB-2026-9788',
    parentOrderNumber: 'ORD-2026-4380',
    status: 'READY_FOR_PICKUP',
    itemSubtotalMinor: 240000,
    shippingFeeMinor: 20000,
    commissionFeeMinor: 36000,
    netSellerPayableMinor: 224000,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    itemCount: 2,
    recipientCity: 'New Delhi',
    recipientState: 'Delhi',
    recipientPostalCode: '110001',
  },
  {
    id: 'sub-ord-104',
    subOrderNumber: 'SUB-2026-9750',
    parentOrderNumber: 'ORD-2026-4320',
    status: 'COMPLETED',
    itemSubtotalMinor: 89000,
    shippingFeeMinor: 10000,
    commissionFeeMinor: 13350,
    netSellerPayableMinor: 85650,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    itemCount: 1,
    recipientCity: 'Pune',
    recipientState: 'Maharashtra',
    recipientPostalCode: '411007',
  },
];

const FALLBACK_ORDER_DETAILS: Record<string, SellerSubOrderDetailDto> = {
  'sub-ord-101': {
    id: 'sub-ord-101',
    subOrderNumber: 'SUB-2026-9812',
    parentOrderNumber: 'ORD-2026-4401',
    status: 'CONFIRMED',
    itemSubtotalMinor: 175000,
    shippingFeeMinor: 15000,
    commissionFeeMinor: 26250,
    netSellerPayableMinor: 163750,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    parentOrderStatus: 'CONFIRMED',
    shippingAddress: {
      recipientName: 'Verified Customer',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'IN',
    },
    items: [
      {
        id: 'item-101',
        variantId: 'var-002',
        titleSnapshot: 'Glazed Stoneware Serving Bowl - Cobalt Blue',
        skuSnapshot: 'POT-BOWL-BLU-LG',
        unitPriceMinor: 175000,
        quantity: 1,
        totalPriceMinor: 175000,
        customizationInput: 'Please engrave "Ananya & Rahul - 2026" on underside rim.',
      },
    ],
    timeline: [
      {
        id: 'tl-1',
        toStatus: 'CONFIRMED',
        notes: 'Customer completed payment. Order confirmed for artisan production.',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
    ],
  },
  'sub-ord-102': {
    id: 'sub-ord-102',
    subOrderNumber: 'SUB-2026-9801',
    parentOrderNumber: 'ORD-2026-4395',
    status: 'IN_PRODUCTION',
    itemSubtotalMinor: 178000,
    shippingFeeMinor: 12000,
    commissionFeeMinor: 26700,
    netSellerPayableMinor: 163300,
    currency: 'INR',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    parentPaymentStatus: 'CAPTURED',
    parentOrderStatus: 'PROCESSING',
    shippingAddress: {
      recipientName: 'Verified Customer',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      country: 'IN',
    },
    items: [
      {
        id: 'item-102',
        variantId: 'var-001',
        titleSnapshot: 'Hand-thrown Terracotta Chai Cups (Set of 6)',
        skuSnapshot: 'POT-CHAI-SET6',
        unitPriceMinor: 89000,
        quantity: 2,
        totalPriceMinor: 178000,
      },
    ],
    timeline: [
      {
        id: 'tl-10',
        toStatus: 'CONFIRMED',
        notes: 'Payment captured and verified.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      },
      {
        id: 'tl-11',
        fromStatus: 'CONFIRMED',
        toStatus: 'IN_PRODUCTION',
        notes: 'Artisan started wheel-throwing and drying process.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      },
    ],
  },
};

const FALLBACK_ANALYTICS: SellerAnalyticsPerformanceDto = {
  period: '30d',
  summary: {
    totalOrders: 49,
    grossSalesMinor: 5672000,
    netPayableMinor: 4821200,
    commissionPaidMinor: 850800,
    averageOrderValueMinor: 115755,
    cancellationRateBps: 0,
    completedOrdersCount: 44,
    currency: 'INR',
  },
  salesTrend: [
    { date: '2026-09-14', grossSalesMinor: 178000, ordersCount: 2, netPayableMinor: 151300 },
    { date: '2026-09-18', grossSalesMinor: 240000, ordersCount: 1, netPayableMinor: 204000 },
    { date: '2026-09-22', grossSalesMinor: 350000, ordersCount: 3, netPayableMinor: 297500 },
    { date: '2026-09-27', grossSalesMinor: 520000, ordersCount: 4, netPayableMinor: 442000 },
    { date: '2026-10-02', grossSalesMinor: 445000, ordersCount: 3, netPayableMinor: 378250 },
    { date: '2026-10-06', grossSalesMinor: 610000, ordersCount: 5, netPayableMinor: 518500 },
    { date: '2026-10-10', grossSalesMinor: 322000, ordersCount: 3, netPayableMinor: 273700 },
    { date: '2026-10-13', grossSalesMinor: 180000, ordersCount: 3, netPayableMinor: 153000 },
  ],
  topProducts: [
    {
      variantId: 'var-001',
      title: 'Hand-thrown Terracotta Chai Cups (Set of 6)',
      sku: 'POT-CHAI-SET6',
      unitsSold: 28,
      totalRevenueMinor: 2492000,
    },
    {
      variantId: 'var-002',
      title: 'Glazed Stoneware Serving Bowl - Cobalt Blue',
      sku: 'POT-BOWL-BLU-LG',
      unitsSold: 12,
      totalRevenueMinor: 2100000,
    },
    {
      variantId: 'var-003',
      title: 'Rustic Earthen Planter Pot with Hand-carved Motifs',
      sku: 'POT-PLTR-MED',
      unitsSold: 9,
      totalRevenueMinor: 1080000,
    },
  ],
};

const FALLBACK_NOTIFICATIONS: SellerNotificationDto[] = [
  {
    id: 'notif-1',
    type: 'ORDER',
    title: 'New Customer Order Confirmed',
    message: 'Order SUB-2026-9812 has been confirmed with customisation instructions.',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isRead: false,
    actionUrl: '/orders/sub-ord-101',
  },
  {
    id: 'notif-2',
    type: 'STOCK',
    title: 'Low Stock Alert: Terracotta Chai Cups',
    message: 'Remaining stock (8 sets) is approaching the minimum reserve threshold.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    isRead: false,
    actionUrl: '/inventory',
  },
  {
    id: 'notif-3',
    type: 'ACCOUNT',
    title: 'Escrow Release Completed',
    message: 'Net payout ₹8,450 for SUB-2026-9750 has moved to Available Payout.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isRead: true,
    actionUrl: '/finances',
  },
];

const FALLBACK_SHOP: ShopProfileDto = {
  shopId: 'shop-clay-studio-101',
  sellerId: 'sel-1001',
  shopName: 'Mitti & Kiln Studio',
  shopSlug: 'mitti-and-kiln-studio',
  status: 'ACTIVE',
  description:
    'Studio pottery and earthy terracotta tableware, lovingly hand-thrown on a traditional potter wheel in small batches.',
  craftStory:
    'Founded by master potter Rajesh and ceramic artist Deepa in Kumartuli, Mitti & Kiln blends centuries-old alluvial clay shaping traditions with modern food-safe glaze formulations. Every piece is fired twice in our wood-and-gas kiln, yielding organic textural variations that guarantee no two cups or bowls are completely identical.',
  isVacationMode: false,
  vacationMessage: null,
  ratingAverage: 4.95,
  ratingCount: 38,
};

async function fetchFromApi<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export async function getSellerDashboard(period = '7d'): Promise<SellerDashboardDto> {
  const data = await fetchFromApi<SellerDashboardDto>(
    `/seller/dashboard/overview?period=${period}`,
  );
  if (data) return data;
  return { ...FALLBACK_DASHBOARD, period };
}

export async function getSellerOrders(
  query?: Partial<ListSellerOrdersQuery>,
): Promise<SellerSubOrderListResponseDto> {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'ALL') params.set('status', query.status);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.search) params.set('search', query.search);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await fetchFromApi<SellerSubOrderListResponseDto>(`/seller/orders${qs}`);
  if (data) return data;

  // Filter fallback orders
  let items = [...FALLBACK_ORDER_SUMMARIES];
  if (query?.status && query.status !== 'ALL') {
    items = items.filter((o) => o.status === query.status);
  }
  if (query?.search) {
    const term = query.search.toLowerCase();
    items = items.filter(
      (o) =>
        o.subOrderNumber.toLowerCase().includes(term) ||
        o.parentOrderNumber.toLowerCase().includes(term) ||
        o.recipientCity?.toLowerCase().includes(term),
    );
  }

  return {
    items,
    meta: {
      page: query?.page || 1,
      limit: query?.limit || 20,
      total: items.length,
      totalPages: 1,
    },
  };
}

export async function getSellerOrderDetail(subOrderId: string): Promise<SellerSubOrderDetailDto> {
  const data = await fetchFromApi<SellerSubOrderDetailDto>(`/seller/orders/${subOrderId}`);
  if (data) return data;

  const found =
    FALLBACK_ORDER_DETAILS[subOrderId] ||
    Object.values(FALLBACK_ORDER_DETAILS).find((o) => o.subOrderNumber === subOrderId);
  if (found) return found;

  return FALLBACK_ORDER_DETAILS['sub-ord-101']!;
}

export async function updateSubOrderStatus(
  subOrderId: string,
  input: UpdateSubOrderStatusInput,
): Promise<SellerSubOrderDetailDto> {
  const data = await fetchFromApi<SellerSubOrderDetailDto>(`/seller/orders/${subOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (data) return data;

  const target =
    FALLBACK_ORDER_DETAILS[subOrderId] ||
    Object.values(FALLBACK_ORDER_DETAILS).find((o) => o.subOrderNumber === subOrderId) ||
    FALLBACK_ORDER_DETAILS['sub-ord-101']!;

  target.status = input.status;
  target.timeline.push({
    id: `tl-${Date.now()}`,
    toStatus: input.status,
    notes: input.cancellationReason || input.notes || `Status transitioned to ${input.status}`,
    createdAt: new Date().toISOString(),
  });
  return target;
}

export async function getSellerPerformanceAnalytics(
  period = '30d',
): Promise<SellerAnalyticsPerformanceDto> {
  const data = await fetchFromApi<SellerAnalyticsPerformanceDto>(
    `/seller/analytics/performance?period=${period}`,
  );
  if (data) return data;
  return { ...FALLBACK_ANALYTICS, period };
}

export async function getSellerNotifications(): Promise<SellerNotificationDto[]> {
  const data = await fetchFromApi<SellerNotificationDto[]>('/seller/notifications');
  if (data) return data;
  return FALLBACK_NOTIFICATIONS;
}

export async function getShopProfile(): Promise<ShopProfileDto> {
  const data = await fetchFromApi<ShopProfileDto>('/seller/shop');
  if (data) return data;
  return FALLBACK_SHOP;
}

export async function updateShopProfile(input: UpdateShopProfileInput): Promise<ShopProfileDto> {
  const data = await fetchFromApi<ShopProfileDto>('/seller/shop', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (data) return data;

  Object.assign(FALLBACK_SHOP, input);
  return FALLBACK_SHOP;
}

export async function bookCourierShipment(
  subOrderId: string,
  input: BookShipmentInput,
): Promise<BookShipmentResponseDto> {
  const data = await fetchFromApi<BookShipmentResponseDto>(
    `/seller/orders/${subOrderId}/shipment/book`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (data) return data;

  return {
    shipmentId: `shp-${Date.now()}`,
    subOrderId,
    carrierCode: input.carrierCode || 'DELHIVERY',
    waybillNumber: `DLV-${Date.now().toString().slice(-6)}`,
    trackingNumber: `TRK-DLV-${Date.now().toString().slice(-6)}`,
    status: 'LABEL_CREATED',
    labelUrl: `/api/v1/seller/orders/${subOrderId}/shipment/label`,
    pickupDate: input.pickupDate,
  };
}

export async function getShipmentDetails(subOrderId: string): Promise<ShipmentDto | null> {
  const data = await fetchFromApi<ShipmentDto>(`/seller/orders/${subOrderId}/shipment`);
  return data || null;
}

export async function getShippingLabel(subOrderId: string): Promise<ShippingLabelDto> {
  const data = await fetchFromApi<ShippingLabelDto>(`/seller/orders/${subOrderId}/shipment/label`);
  if (data) return data;

  return {
    shipmentId: `shp-demo`,
    waybillNumber: `DLV-DEMO-9912`,
    carrierCode: 'DELHIVERY',
    labelUrl: `/api/v1/seller/orders/${subOrderId}/shipment/label`,
    contentHtml: '<div>Sample Label</div>',
  };
}

export async function scheduleCourierPickup(
  subOrderId: string,
  input: SchedulePickupInput,
): Promise<SchedulePickupResponseDto> {
  const data = await fetchFromApi<SchedulePickupResponseDto>(
    `/seller/orders/${subOrderId}/shipment/pickup`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (data) return data;

  return {
    shipmentId: `shp-demo`,
    pickupScheduled: true,
    pickupDate: input.pickupDate,
    pickupToken: `PKP-${Date.now().toString().slice(-6)}`,
    status: 'PICKUP_SCHEDULED',
  };
}

export async function cancelCourierShipment(
  subOrderId: string,
  input: CancelShipmentInput,
): Promise<CancelShipmentResponseDto> {
  const data = await fetchFromApi<CancelShipmentResponseDto>(
    `/seller/orders/${subOrderId}/shipment/cancel`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (data) return data;

  return {
    shipmentId: `shp-demo`,
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
    reason: input.reason,
  };
}
