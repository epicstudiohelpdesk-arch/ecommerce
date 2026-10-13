export interface CustomerAddressDto {
  id: string;
  customerId: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  locality?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  deliveryInstructions?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingOptionDto {
  id: string;
  sellerId: string;
  shopName: string;
  carrierName: string;
  serviceName: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  rateMinor: number;
}

export interface PricingBreakdownSellerDto {
  sellerId: string;
  shopName: string;
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  sellerDiscountMinor: number;
  taxMinor: number;
  sellerTotalMinor: number;
  commissionFeeMinor: number;
  netSellerPayableMinor: number;
}

export interface PricingBreakdownDto {
  currency: string;
  subtotalMinor: number;
  shippingTotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  grandTotalMinor: number;
  couponCode?: string | null;
  sellers: PricingBreakdownSellerDto[];
}

export interface CheckoutSessionDto {
  checkoutId: string;
  cartId: string;
  customerId?: string | null;
  expiresAt: string;
  pricing: PricingBreakdownDto;
  deliveryAddress?: CustomerAddressDto | null;
  reservationIds: string[];
}

export interface SubOrderSummaryDto {
  id: string;
  subOrderNumber: string;
  sellerId: string;
  shopName: string;
  status: string;
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  taxMinor: number;
  itemCount: number;
}

export interface CheckoutOrderConfirmationDto {
  orderId: string;
  orderNumber: string;
  customerId: string;
  totalAmountMinor: number;
  currency: string;
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  orderStatus: 'PLACED' | 'PROCESSING' | 'PARTIALLY_SHIPPED' | 'COMPLETED' | 'CANCELLED';
  placedAt: string;
  shippingAddress: CustomerAddressDto;
  subOrders: SubOrderSummaryDto[];
  notice: string;
}
