export type CarrierCode = 'DELHIVERY' | 'SHIPROCKET' | 'BLUEDART' | 'MOCK_COURIER';

export type ShipmentStatus =
  | 'LABEL_CREATED'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERY_FAILED'
  | 'DELIVERED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED'
  | 'CANCELLED';

export interface PackageDimensionsDto {
  length: number;
  width: number;
  height: number;
}

export interface ShipmentMilestoneDto {
  id: string;
  status: string;
  location?: string | null;
  description: string;
  eventTime: string;
}

export interface ShipmentDto {
  id: string;
  subOrderId: string;
  orderNumber?: string;
  carrierCode: CarrierCode;
  status: ShipmentStatus;
  waybillNumber?: string | null;
  trackingNumber?: string | null;
  packageWeightGrams: number;
  packageDimensionsMm: PackageDimensionsDto;
  pickupDate?: string | null;
  labelUrl?: string | null;
  cancellationReason?: string | null;
  carrierMetadata?: Record<string, unknown> | null;
  pickupAddressSnapshot?: Record<string, unknown> | null;
  deliveryAddressSnapshot?: Record<string, unknown> | null;
  milestones?: ShipmentMilestoneDto[];
  createdAt: string;
  updatedAt: string;
}

export interface BookShipmentRequestDto {
  packageWeightGrams: number;
  packageDimensionsMm: PackageDimensionsDto;
  pickupDate: string;
  carrierCode?: CarrierCode;
  notes?: string;
}

export interface BookShipmentResponseDto {
  shipmentId: string;
  subOrderId: string;
  carrierCode: CarrierCode;
  waybillNumber: string;
  trackingNumber: string;
  status: ShipmentStatus;
  labelUrl: string;
  pickupDate: string;
}

export interface ShippingLabelDto {
  shipmentId: string;
  waybillNumber: string;
  carrierCode: string;
  labelUrl: string;
  contentHtml?: string;
}

export interface SchedulePickupRequestDto {
  pickupDate: string;
  timeSlot?: string;
  notes?: string;
}

export interface SchedulePickupResponseDto {
  shipmentId: string;
  pickupScheduled: boolean;
  pickupDate: string;
  pickupToken?: string;
  status: ShipmentStatus;
}

export interface CancelShipmentRequestDto {
  reason: string;
}

export interface CancelShipmentResponseDto {
  shipmentId: string;
  status: ShipmentStatus;
  cancelledAt: string;
  reason: string;
}

export interface ServiceabilityResponseDto {
  serviceable: boolean;
  originPostalCode: string;
  destinationPostalCode: string;
  carrierCode: CarrierCode;
  estimatedDeliveryDays: number;
  codAvailable: boolean;
}

export interface TrackingCheckpointDto {
  status: string;
  location?: string | null;
  description: string;
  timestamp: string;
}

export interface OrderTrackingDto {
  orderNumber: string;
  subOrderId: string;
  sellerShopName: string;
  carrier: CarrierCode;
  carrierName: string;
  trackingNumber: string;
  status: ShipmentStatus;
  estimatedDeliveryDate?: string | null;
  checkpoints: TrackingCheckpointDto[];
}

export interface CustomerTrackingResponseDto {
  orderNumber: string;
  customerOrderState: string;
  shipments: OrderTrackingDto[];
}
