CREATE TYPE "public"."user_status" AS ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."document_verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."seller_business_type" AS ENUM('INDIVIDUAL', 'SOLE_PROPRIETORSHIP', 'REGISTERED_COMPANY');--> statement-breakpoint
CREATE TYPE "public"."seller_document_type" AS ENUM('GOVERNMENT_ID', 'TAX_CERTIFICATE', 'BANK_PROOF', 'ARTISAN_CERTIFICATE');--> statement-breakpoint
CREATE TYPE "public"."seller_verification_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."product_moderation_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('READY_TO_SHIP', 'ONE_OF_A_KIND', 'MADE_TO_ORDER', 'PERSONALIZED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."stock_adjustment_reason" AS ENUM('MANUAL_CORRECTION', 'RECEIPT', 'BREAKAGE', 'SALE_COMMITTED', 'RETURN_RESTOCK', 'AUDIT_DISCREPANCY');--> statement-breakpoint
CREATE TYPE "public"."coupon_funded_by" AS ENUM('PLATFORM', 'SELLER');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PLACED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."sub_order_status" AS ENUM('CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('INITIATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('STRIPE', 'RAZORPAY', 'MOCK_PROVIDER');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('CUSTOMER_CANCELLATION', 'DEFECTIVE_ITEM', 'ITEM_NOT_RECEIVED', 'SELLER_UNFULFILLED', 'DISPUTE_RESOLUTION');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."payout_batch_status" AS ENUM('PENDING', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_SETTLED');--> statement-breakpoint
CREATE TYPE "public"."payout_transaction_status" AS ENUM('PENDING', 'SUBMITTED', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('REQUESTED', 'APPROVED', 'ITEM_SHIPPED', 'ITEM_RECEIVED', 'REFUNDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('LABEL_CREATED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_INITIATED', 'RTO_DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."dispute_reason" AS ENUM('DAMAGED_HANDMADE_GOOD', 'NOT_AS_DESCRIBED', 'NOT_DELIVERED', 'UNAUTHORIZED_RETURN_REJECTION');--> statement-breakpoint
CREATE TYPE "public"."dispute_resolution" AS ENUM('FULL_REFUND', 'PARTIAL_REFUND', 'REJECTED', 'SELLER_FAVORED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."review_moderation_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."support_category" AS ENUM('ORDER_ISSUE', 'PAYMENT_DISPUTE', 'SHIPPING_DELAY', 'SELLER_VERIFICATION', 'GENERAL_INQUIRY');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"seller_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(30),
	"status" "user_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "chk_users_email_format" CHECK ("users"."email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"provider" varchar(50) DEFAULT 'STRIPE_CONNECT' NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"beneficiary_name" varchar(255) NOT NULL,
	"account_last4" varchar(4) NOT NULL,
	"bank_name" varchar(100),
	"routing_number" varchar(50),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"contact_name" varchar(100) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"country" varchar(2) DEFAULT 'IN' NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"document_type" "seller_document_type" NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"status" "document_verification_status" DEFAULT 'PENDING' NOT NULL,
	"review_notes" text,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_seller_docs_size_positive" CHECK ("seller_documents"."file_size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_type" "seller_business_type" NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"tax_id" varchar(100),
	"verification_status" "seller_verification_status" DEFAULT 'DRAFT' NOT NULL,
	"compliance_tier" smallint DEFAULT 1 NOT NULL,
	"is_payout_enabled" boolean DEFAULT false NOT NULL,
	"commission_rate_bps" integer DEFAULT 1000 NOT NULL,
	"rejection_reason" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_seller_commission_rate" CHECK ("seller_profiles"."commission_rate_bps" >= 0 AND "seller_profiles"."commission_rate_bps" <= 10000),
	CONSTRAINT "chk_seller_compliance_tier" CHECK ("seller_profiles"."compliance_tier" >= 1 AND "seller_profiles"."compliance_tier" <= 3)
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"logo_url" varchar(500),
	"banner_url" varchar(500),
	"craft_story" text,
	"policies" jsonb,
	"is_vacation_mode" boolean DEFAULT false NOT NULL,
	"vacation_message" text,
	"rating_average" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_seller_id_unique" UNIQUE("seller_id"),
	CONSTRAINT "shops_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_shops_slug_format" CHECK ("shops"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "chk_shops_rating_range" CHECK ("shops"."rating_average" >= 0.00 AND "shops"."rating_average" <= 5.00)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"image_url" varchar(500),
	"commission_rate_bps" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_category_commission_bps" CHECK ("categories"."commission_rate_bps" IS NULL OR ("categories"."commission_rate_bps" >= 0 AND "categories"."commission_rate_bps" <= 10000))
);
--> statement-breakpoint
CREATE TABLE "moderation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"moderator_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"media_type" "media_type" DEFAULT 'IMAGE' NOT NULL,
	"url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"alt_text" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"title" varchar(150) NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"compare_at_price_minor" bigint,
	"weight_grams" integer NOT NULL,
	"dimension_length_mm" integer NOT NULL,
	"dimension_width_mm" integer NOT NULL,
	"dimension_height_mm" integer NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "chk_variants_price" CHECK ("product_variants"."price_minor" >= 0),
	CONSTRAINT "chk_variants_weight" CHECK ("product_variants"."weight_grams" > 0),
	CONSTRAINT "chk_variants_dimensions" CHECK ("product_variants"."dimension_length_mm" > 0 AND "product_variants"."dimension_width_mm" > 0 AND "product_variants"."dimension_height_mm" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"product_type" "product_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"base_price_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"moderation_status" "product_moderation_status" DEFAULT 'DRAFT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_fragile" boolean DEFAULT false NOT NULL,
	"is_customizable" boolean DEFAULT false NOT NULL,
	"customization_instructions" text,
	"production_lead_time_days" integer DEFAULT 0 NOT NULL,
	"materials" text[],
	"techniques" text[],
	"care_instructions" text,
	"country_of_origin" varchar(2) DEFAULT 'IN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chk_products_base_price" CHECK ("products"."base_price_minor" >= 0),
	CONSTRAINT "chk_products_lead_time" CHECK ("products"."production_lead_time_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 2 NOT NULL,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_variant_id_unique" UNIQUE("variant_id"),
	CONSTRAINT "chk_inventory_on_hand_positive" CHECK ("inventory_items"."quantity_on_hand" >= 0),
	CONSTRAINT "chk_inventory_reserved_positive" CHECK ("inventory_items"."quantity_reserved" >= 0),
	CONSTRAINT "chk_inventory_reserved_le_on_hand" CHECK ("inventory_items"."quantity_reserved" <= "inventory_items"."quantity_on_hand")
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"cart_id" uuid,
	"checkout_id" varchar(100),
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_reservation_quantity_positive" CHECK ("inventory_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity_delta" integer NOT NULL,
	"reason" "stock_adjustment_reason" NOT NULL,
	"actor_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"customization_text" text,
	"customization_options" jsonb,
	"price_snapshot_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cart_items_quantity" CHECK ("cart_items"."quantity" > 0),
	CONSTRAINT "chk_cart_items_price" CHECK ("cart_items"."price_snapshot_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"session_id" varchar(100),
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid,
	"code" varchar(50) NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"min_order_minor" bigint DEFAULT 0 NOT NULL,
	"max_discount_minor" bigint,
	"funded_by" "coupon_funded_by" DEFAULT 'PLATFORM' NOT NULL,
	"usage_limit" integer,
	"times_used" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "chk_coupons_discount_value" CHECK ("coupons"."discount_value" > 0),
	CONSTRAINT "chk_coupons_min_order" CHECK ("coupons"."min_order_minor" >= 0),
	CONSTRAINT "chk_coupons_times_used" CHECK ("coupons"."times_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pricing_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_id" varchar(100) NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"shipping_total_minor" bigint NOT NULL,
	"discount_total_minor" bigint DEFAULT 0 NOT NULL,
	"tax_total_minor" bigint DEFAULT 0 NOT NULL,
	"grand_total_minor" bigint NOT NULL,
	"breakdown_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_snapshots_checkout_id_unique" UNIQUE("checkout_id"),
	CONSTRAINT "chk_pricing_subtotal" CHECK ("pricing_snapshots"."subtotal_minor" >= 0),
	CONSTRAINT "chk_pricing_shipping" CHECK ("pricing_snapshots"."shipping_total_minor" >= 0),
	CONSTRAINT "chk_pricing_grand_total" CHECK ("pricing_snapshots"."grand_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"payment_status" "order_payment_status" DEFAULT 'PENDING' NOT NULL,
	"order_status" "order_status" DEFAULT 'PLACED' NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb NOT NULL,
	"customer_note" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "chk_orders_total_positive" CHECK ("customer_orders"."total_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"title_snapshot" varchar(255) NOT NULL,
	"sku_snapshot" varchar(100) NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"total_price_minor" bigint NOT NULL,
	"customization_input" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_order_items_quantity" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "chk_order_items_unit_price" CHECK ("order_items"."unit_price_minor" >= 0),
	CONSTRAINT "chk_order_items_total_price" CHECK ("order_items"."total_price_minor" = "order_items"."unit_price_minor" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "order_timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"from_status" varchar(50),
	"to_status" varchar(50) NOT NULL,
	"actor_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_number" varchar(60) NOT NULL,
	"parent_order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"status" "sub_order_status" DEFAULT 'CONFIRMED' NOT NULL,
	"item_subtotal_minor" bigint NOT NULL,
	"shipping_fee_minor" bigint NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_fee_minor" bigint NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"net_seller_payable_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sub_orders_sub_order_number_unique" UNIQUE("sub_order_number"),
	CONSTRAINT "uq_sub_orders_id_seller" UNIQUE("id","seller_id"),
	CONSTRAINT "chk_sub_orders_item_subtotal" CHECK ("sub_orders"."item_subtotal_minor" >= 0),
	CONSTRAINT "chk_sub_orders_shipping_fee" CHECK ("sub_orders"."shipping_fee_minor" >= 0),
	CONSTRAINT "chk_sub_orders_commission_fee" CHECK ("sub_orders"."commission_fee_minor" >= 0),
	CONSTRAINT "chk_sub_orders_net_payable" CHECK ("sub_orders"."net_seller_payable_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_attempt_id" uuid NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"allocated_amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_allocations_amount_positive" CHECK ("payment_allocations"."allocated_amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_intent_id" varchar(255) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'INITIATED' NOT NULL,
	"error_code" varchar(100),
	"error_message" text,
	"idempotency_key" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_provider_intent_id_unique" UNIQUE("provider_intent_id"),
	CONSTRAINT "payment_attempts_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "chk_payment_attempt_amount" CHECK ("payment_attempts"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"payment_attempt_id" uuid NOT NULL,
	"refund_number" varchar(60) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"status" "refund_status" DEFAULT 'REQUESTED' NOT NULL,
	"provider_refund_id" varchar(255),
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_requests_refund_number_unique" UNIQUE("refund_number"),
	CONSTRAINT "refund_requests_provider_refund_id_unique" UNIQUE("provider_refund_id"),
	CONSTRAINT "chk_refunds_amount_positive" CHECK ("refund_requests"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_batch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"seller_id" uuid,
	"sub_order_id" uuid,
	"payout_batch_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"description" varchar(255) NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ledger_amount_positive" CHECK ("ledger_entries"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payout_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" varchar(60) NOT NULL,
	"status" "payout_batch_status" DEFAULT 'PENDING' NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"total_recipients" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"initiated_by" uuid NOT NULL,
	"authorized_by" uuid,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_batches_batch_number_unique" UNIQUE("batch_number"),
	CONSTRAINT "chk_payout_batches_amount" CHECK ("payout_batches"."total_amount_minor" > 0),
	CONSTRAINT "chk_payout_batches_recipients" CHECK ("payout_batches"."total_recipients" > 0)
);
--> statement-breakpoint
CREATE TABLE "payout_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"payout_account_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payout_transaction_status" DEFAULT 'PENDING' NOT NULL,
	"provider_transfer_id" varchar(255),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_transactions_provider_transfer_id_unique" UNIQUE("provider_transfer_id"),
	CONSTRAINT "chk_payout_tx_amount" CHECK ("payout_transactions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "seller_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"pending_escrow_minor" bigint DEFAULT 0 NOT NULL,
	"available_payout_minor" bigint DEFAULT 0 NOT NULL,
	"held_dispute_minor" bigint DEFAULT 0 NOT NULL,
	"lifetime_payout_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_balances_seller_id_unique" UNIQUE("seller_id"),
	CONSTRAINT "chk_balances_pending_escrow" CHECK ("seller_balances"."pending_escrow_minor" >= 0),
	CONSTRAINT "chk_balances_available_payout" CHECK ("seller_balances"."available_payout_minor" >= 0),
	CONSTRAINT "chk_balances_held_dispute" CHECK ("seller_balances"."held_dispute_minor" >= 0),
	CONSTRAINT "chk_balances_lifetime_payout" CHECK ("seller_balances"."lifetime_payout_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "return_status" DEFAULT 'REQUESTED' NOT NULL,
	"reason" varchar(255) NOT NULL,
	"proof_image_urls" text[],
	"seller_notes" text,
	"tracking_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" "shipment_status" NOT NULL,
	"location" varchar(150),
	"description" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"courier_code" varchar(50) NOT NULL,
	"tracking_number" varchar(100) NOT NULL,
	"waybill_number" varchar(100),
	"label_url" varchar(500),
	"status" "shipment_status" DEFAULT 'LABEL_CREATED' NOT NULL,
	"weight_grams" integer NOT NULL,
	"length_mm" integer NOT NULL,
	"width_mm" integer NOT NULL,
	"height_mm" integer NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_sub_order_id_unique" UNIQUE("sub_order_id"),
	CONSTRAINT "chk_shipments_weight" CHECK ("shipments"."weight_grams" > 0),
	CONSTRAINT "chk_shipments_dimensions" CHECK ("shipments"."length_mm" > 0 AND "shipments"."width_mm" > 0 AND "shipments"."height_mm" > 0)
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_number" varchar(50) NOT NULL,
	"sub_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"reason" "dispute_reason" NOT NULL,
	"claimed_amount_minor" bigint NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" "dispute_resolution",
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_dispute_number_unique" UNIQUE("dispute_number"),
	CONSTRAINT "chk_disputes_amount_positive" CHECK ("disputes"."claimed_amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" varchar(150),
	"comment" text,
	"image_urls" text[],
	"moderation_status" "review_moderation_status" DEFAULT 'PENDING' NOT NULL,
	"seller_reply" text,
	"seller_replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_item_id_unique" UNIQUE("order_item_id"),
	CONSTRAINT "chk_reviews_rating_range" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(50) NOT NULL,
	"creator_id" uuid NOT NULL,
	"assigned_agent_id" uuid,
	"category" "support_category" NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'MEDIUM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(150) NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_addresses" ADD CONSTRAINT "pickup_addresses_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_sub_order_seller" FOREIGN KEY ("sub_order_id","seller_id") REFERENCES "public"."sub_orders"("id","seller_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_timeline_events" ADD CONSTRAINT "order_timeline_events_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_timeline_events" ADD CONSTRAINT "order_timeline_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_parent_order_id_customer_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."customer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_parent_order_id_customer_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."customer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_authorized_by_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_transactions" ADD CONSTRAINT "payout_transactions_batch_id_payout_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payout_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_transactions" ADD CONSTRAINT "payout_transactions_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_transactions" ADD CONSTRAINT "payout_transactions_payout_account_id_payout_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."payout_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balances" ADD CONSTRAINT "seller_balances_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_milestones" ADD CONSTRAINT "shipment_milestones_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_seller_id_seller_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_user" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_seller" ON "user_roles" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_roles_unique" ON "user_roles" USING btree ("user_id","role_id",COALESCE("seller_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_created_at" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payout_accounts_seller" ON "payout_accounts" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_payout_accounts_provider_id" ON "payout_accounts" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_pickup_addresses_seller" ON "pickup_addresses" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_seller_docs_seller" ON "seller_documents" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_seller_docs_status" ON "seller_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_seller_profiles_status" ON "seller_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_seller_profiles_user" ON "seller_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shops_seller" ON "shops" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_shops_slug" ON "shops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_moderation_product" ON "moderation_records" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_moderator" ON "moderation_records" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "idx_media_product" ON "product_media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_media_variant" ON "product_media" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_variants_sku" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_products_seller" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "idx_products_type" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_variant" ON "inventory_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_variant" ON "inventory_reservations" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_status_expires" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "idx_reservations_checkout" ON "inventory_reservations" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_variant" ON "stock_adjustments" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_created_at" ON "stock_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cart_items_cart" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cart_items_unique_variant" ON "cart_items" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_carts_customer" ON "carts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_carts_session" ON "carts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_carts_expires" ON "carts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_coupons_code" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_coupons_seller" ON "coupons" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_snapshots_checkout" ON "pricing_snapshots" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "idx_orders_customer" ON "customer_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "customer_orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "idx_orders_payment_status" ON "customer_orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_orders_placed_at" ON "customer_orders" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX "idx_order_items_sub_order" ON "order_items" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_seller" ON "order_items" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_variant" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_order_timeline_sub_order" ON "order_timeline_events" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_order_timeline_created_at" ON "order_timeline_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sub_orders_parent" ON "sub_orders" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "idx_sub_orders_seller" ON "sub_orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_sub_orders_shop" ON "sub_orders" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_sub_orders_status" ON "sub_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_allocations_payment_attempt" ON "payment_allocations" USING btree ("payment_attempt_id");--> statement-breakpoint
CREATE INDEX "idx_allocations_sub_order" ON "payment_allocations" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_attempts_parent" ON "payment_attempts" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "idx_payment_attempts_status" ON "payment_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_attempts_idempotency" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_provider_event" ON "payment_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_processed" ON "payment_webhook_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_refunds_sub_order" ON "refund_requests" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_status" ON "refund_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ledger_accounts_code" ON "ledger_accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_ledger_accounts_type" ON "ledger_accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_ledger_journal_batch" ON "ledger_entries" USING btree ("journal_batch_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_account" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_seller" ON "ledger_entries" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_sub_order" ON "ledger_entries" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_posted_at" ON "ledger_entries" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "idx_payout_batches_status" ON "payout_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payout_tx_batch" ON "payout_transactions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_payout_tx_seller" ON "payout_transactions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_payout_tx_status" ON "payout_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_seller_balances_seller" ON "seller_balances" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_returns_sub_order" ON "return_requests" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_returns_customer" ON "return_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_returns_status" ON "return_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_milestones_shipment" ON "shipment_milestones" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "idx_milestones_event_time" ON "shipment_milestones" USING btree ("event_time");--> statement-breakpoint
CREATE INDEX "idx_shipments_sub_order" ON "shipments" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_shipments_tracking" ON "shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "idx_shipments_status" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disputes_sub_order" ON "disputes" USING btree ("sub_order_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_seller" ON "disputes" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_customer" ON "disputes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_status" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reviews_product" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_customer" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_status" ON "reviews" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_creator" ON "support_tickets" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_agent" ON "support_tickets" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_outbox_unpublished" ON "outbox_events" USING btree ("published","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");