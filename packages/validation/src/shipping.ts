import { z } from 'zod';

export const CARRIER_CODES = ['DELHIVERY', 'SHIPROCKET', 'BLUEDART', 'MOCK_COURIER'] as const;
export const carrierCodeSchema = z.enum(CARRIER_CODES);
export type CarrierCode = z.infer<typeof carrierCodeSchema>;

export const SHIPMENT_STATUSES = [
  'LABEL_CREATED',
  'PICKUP_SCHEDULED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'DELIVERED',
  'RTO_INITIATED',
  'RTO_DELIVERED',
  'CANCELLED',
] as const;
export const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;

export const packageDimensionsSchema = z.object({
  length: z.number().int().min(1, { message: 'Length must be at least 1 mm' }).max(2500),
  width: z.number().int().min(1, { message: 'Width must be at least 1 mm' }).max(2500),
  height: z.number().int().min(1, { message: 'Height must be at least 1 mm' }).max(2500),
});
export type PackageDimensions = z.infer<typeof packageDimensionsSchema>;

export const bookShipmentSchema = z.object({
  packageWeightGrams: z
    .number()
    .int()
    .min(1, { message: 'Package weight must be at least 1 gram' })
    .max(50000, { message: 'Package weight cannot exceed 50,000 grams (50kg)' }),
  packageDimensionsMm: packageDimensionsSchema,
  pickupDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/, {
      message: 'Pickup date must be a valid ISO date string (YYYY-MM-DD)',
    }),
  carrierCode: carrierCodeSchema.default('DELHIVERY'),
  notes: z.string().trim().max(500).optional(),
});
export type BookShipmentInput = z.infer<typeof bookShipmentSchema>;

export const schedulePickupSchema = z.object({
  pickupDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/, {
      message: 'Pickup date must be a valid ISO date string',
    }),
  timeSlot: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type SchedulePickupInput = z.infer<typeof schedulePickupSchema>;

export const cancelShipmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Cancellation reason must be at least 3 characters' })
    .max(500),
});
export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;

export const serviceabilityQuerySchema = z.object({
  originPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, { message: 'Origin must be a 6-digit Indian PIN code' }),
  destinationPostalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, { message: 'Destination must be a 6-digit Indian PIN code' }),
});
export type ServiceabilityQuery = z.infer<typeof serviceabilityQuerySchema>;

export const trackingWebhookPayloadSchema = z.object({
  provider: carrierCodeSchema,
  waybillNumber: z.string().trim().min(3),
  trackingNumber: z.string().trim().min(3).optional(),
  status: z.string().trim().min(2),
  location: z.string().trim().max(150).optional(),
  description: z.string().trim().min(1).max(1000),
  eventTime: z.string().trim().optional(),
  rawPayload: z.record(z.unknown()).optional(),
});
export type TrackingWebhookPayload = z.infer<typeof trackingWebhookPayloadSchema>;
