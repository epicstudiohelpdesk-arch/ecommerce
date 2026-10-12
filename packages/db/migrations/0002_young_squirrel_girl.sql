ALTER TYPE "public"."product_moderation_status" ADD VALUE 'PUBLISHED' BEFORE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."product_moderation_status" ADD VALUE 'ARCHIVED' BEFORE 'SUSPENDED';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" varchar(500);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_products_seller_status" ON "products" USING btree ("seller_id","moderation_status");--> statement-breakpoint
CREATE INDEX "idx_products_public_listing" ON "products" USING btree ("moderation_status","is_active");