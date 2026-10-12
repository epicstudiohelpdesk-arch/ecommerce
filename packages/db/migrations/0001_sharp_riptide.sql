ALTER TABLE "seller_profiles" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "terms_accepted_version" varchar(50);--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "terms_accepted_at" timestamp with time zone;