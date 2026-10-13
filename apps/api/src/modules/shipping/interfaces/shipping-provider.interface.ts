export type ShippingProviderCode = 'DELHIVERY' | 'SHIPROCKET' | 'BLUEDART' | 'MOCK_COURIER';

export interface AddressInfo {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BookShipmentProviderParams {
  subOrderId: string;
  subOrderNumber: string;
  parentOrderNumber: string;
  originAddress: AddressInfo;
  destinationAddress: AddressInfo;
  weightGrams: number;
  dimensionsMm: {
    length: number;
    width: number;
    height: number;
  };
  pickupDate: string;
  declaredValueMinor: number;
  currency: string;
  isCod: boolean;
  notes?: string;
}

export interface BookShipmentProviderResult {
  waybillNumber: string;
  trackingNumber: string;
  labelUrl?: string;
  pickupToken?: string;
  estimatedDeliveryDays?: number;
  carrierMetadata?: Record<string, unknown>;
}

export interface ShippingLabelDetails {
  waybillNumber: string;
  trackingNumber: string;
  subOrderNumber: string;
  parentOrderNumber: string;
  originAddress: AddressInfo;
  destinationAddress: AddressInfo;
  weightGrams: number;
  dimensionsMm: {
    length: number;
    width: number;
    height: number;
  };
  carrierName: string;
  shippedAt?: Date;
}

export interface ShippingLabelResult {
  labelUrl: string;
  contentHtml: string;
}

export interface SchedulePickupProviderParams {
  waybillNumber: string;
  pickupAddress: AddressInfo;
  pickupDate: string;
  timeSlot?: string;
  packageCount: number;
  notes?: string;
}

export interface SchedulePickupProviderResult {
  pickupScheduled: boolean;
  pickupToken: string;
  confirmedDate: string;
  carrierMetadata?: Record<string, unknown>;
}

export interface CancelShipmentProviderResult {
  cancelled: boolean;
  cancellationReference: string;
  message: string;
}

export interface TrackingMilestoneResult {
  status: string;
  location?: string | null;
  description: string;
  eventTime: Date;
  rawPayload?: Record<string, unknown>;
}

export interface TrackingDetailsResult {
  waybillNumber: string;
  trackingNumber: string;
  currentStatus: string;
  carrier: ShippingProviderCode;
  estimatedDeliveryDate?: Date | null;
  milestones: TrackingMilestoneResult[];
}

export interface ServiceabilityResult {
  serviceable: boolean;
  originPostalCode: string;
  destinationPostalCode: string;
  carrierCode: ShippingProviderCode;
  estimatedDeliveryDays: number;
  codAvailable: boolean;
}

export interface IShippingProvider {
  readonly providerCode: ShippingProviderCode;
  readonly carrierName: string;

  checkServiceability(
    originPostalCode: string,
    destPostalCode: string,
  ): Promise<ServiceabilityResult>;

  bookShipment(params: BookShipmentProviderParams): Promise<BookShipmentProviderResult>;

  generateShippingLabel(details: ShippingLabelDetails): Promise<ShippingLabelResult>;

  schedulePickup(params: SchedulePickupProviderParams): Promise<SchedulePickupProviderResult>;

  cancelShipment(waybillNumber: string, reason: string): Promise<CancelShipmentProviderResult>;

  fetchTracking(waybillNumber: string): Promise<TrackingDetailsResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean;
}
