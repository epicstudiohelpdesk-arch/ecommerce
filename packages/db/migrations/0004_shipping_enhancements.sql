ALTER TYPE "public"."shipment_status" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';--> statement-breakpoint
ALTER TYPE "public"."shipment_status" ADD VALUE IF NOT EXISTS 'CANCELLED';--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_address_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "delivery_address_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "carrier_metadata" jsonb;
