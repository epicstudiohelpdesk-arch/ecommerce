import type {
  AdminDashboardMetricsDto,
  AdminOrderDetailDto,
  PaginatedAdminOrdersDto,
  AdminShipmentDetailDto,
  PaginatedAdminShipmentsDto,
  AdminAuditLogDetailDto,
  PaginatedAdminAuditLogsDto,
  AdminStaffUserDto,
  PaginatedAdminStaffDto,
  SellerApplicationSummary,
  SellerApplicationDetail,
} from '@repo/api-contracts';
import type {
  AdminOrderQuery,
  AdminShipmentQuery,
  AdminAuditQuery,
  AdminStaffQuery,
  CreateStaffUserInput,
  UpdateStaffStatusInput,
} from '@repo/validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function requestApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  const json = await res.json();
  return (json.data ?? json) as T;
}

// 1. Dashboard Metrics
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetricsDto> {
  return requestApi<AdminDashboardMetricsDto>('/admin/dashboard');
}

// 2. Sellers & KYC
export async function getAdminSellers(query?: {
  status?: string;
  businessType?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: SellerApplicationSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.businessType) params.set('businessType', query.businessType);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<{
    items: SellerApplicationSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/admin/sellers${qs}`);
}

export async function getAdminSellerDetail(sellerId: string): Promise<SellerApplicationDetail> {
  return requestApi<SellerApplicationDetail>(`/admin/sellers/${sellerId}`);
}

export async function reviewSellerApplication(
  sellerId: string,
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
  notes?: string,
  rejectionReason?: string,
) {
  return requestApi(`/admin/sellers/${sellerId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes, rejectionReason }),
  });
}

export async function suspendSeller(sellerId: string, reason: string) {
  return requestApi(`/admin/sellers/${sellerId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function reinstateSeller(sellerId: string, reason?: string) {
  return requestApi(`/admin/sellers/${sellerId}/reinstate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// 3. Product Moderation Queue
export interface AdminModerationProductItem {
  id: string;
  sellerId: string;
  sellerLegalName: string;
  shopName: string;
  title: string;
  slug: string;
  categoryName: string;
  productType: string;
  basePriceMinor: number;
  currency: string;
  submittedAt: string;
  materials?: string[];
  techniques?: string[];
  isFragile?: boolean;
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
}

export async function getAdminModerationQueue(query?: { page?: number; limit?: number }): Promise<{
  items: AdminModerationProductItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<{
    items: AdminModerationProductItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/admin/catalog/moderation${qs}`);
}

export async function getAdminProductForModeration(productId: string) {
  return requestApi<Record<string, unknown>>(`/admin/catalog/products/${productId}`);
}

export async function moderateProduct(
  productId: string,
  action: 'APPROVE' | 'REJECT' | 'SUSPEND',
  notes?: string,
  reasonCode?: string,
) {
  return requestApi(`/admin/catalog/products/${productId}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ action, notes, reasonCode }),
  });
}

// 4. Order Operations
export async function getAdminOrders(
  query?: Partial<AdminOrderQuery>,
): Promise<PaginatedAdminOrdersDto> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.orderStatus) params.set('orderStatus', query.orderStatus);
  if (query?.paymentStatus) params.set('paymentStatus', query.paymentStatus);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<PaginatedAdminOrdersDto>(`/admin/orders${qs}`);
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetailDto> {
  return requestApi<AdminOrderDetailDto>(`/admin/orders/${orderId}`);
}

// 5. Shipment Oversight
export async function getAdminShipments(
  query?: Partial<AdminShipmentQuery>,
): Promise<PaginatedAdminShipmentsDto> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.status) params.set('status', query.status);
  if (query?.carrier) params.set('carrier', query.carrier);
  if (query?.hasException !== undefined) params.set('hasException', String(query.hasException));
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<PaginatedAdminShipmentsDto>(`/admin/shipments${qs}`);
}

export async function getAdminShipmentDetail(shipmentId: string): Promise<AdminShipmentDetailDto> {
  return requestApi<AdminShipmentDetailDto>(`/admin/shipments/${shipmentId}`);
}

// 6. Staff Management
export async function getAdminStaff(
  query?: Partial<AdminStaffQuery>,
): Promise<PaginatedAdminStaffDto> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.role) params.set('role', query.role);
  if (query?.status) params.set('status', query.status);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<PaginatedAdminStaffDto>(`/admin/staff${qs}`);
}

export async function createAdminStaff(input: CreateStaffUserInput): Promise<AdminStaffUserDto> {
  return requestApi<AdminStaffUserDto>('/admin/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminStaffStatus(
  userId: string,
  input: UpdateStaffStatusInput,
): Promise<AdminStaffUserDto> {
  return requestApi<AdminStaffUserDto>(`/admin/staff/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// 7. Audit Log Viewer
export async function getAdminAuditLogs(
  query?: Partial<AdminAuditQuery>,
): Promise<PaginatedAdminAuditLogsDto> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.actorRole) params.set('actorRole', query.actorRole);
  if (query?.action) params.set('action', query.action);
  if (query?.resourceType) params.set('resourceType', query.resourceType);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return requestApi<PaginatedAdminAuditLogsDto>(`/admin/audit${qs}`);
}

export async function getAdminAuditLogDetail(id: string): Promise<AdminAuditLogDetailDto> {
  return requestApi<AdminAuditLogDetailDto>(`/admin/audit/${id}`);
}
