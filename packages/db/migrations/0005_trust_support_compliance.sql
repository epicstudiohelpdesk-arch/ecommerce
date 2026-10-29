DO $$ BEGIN
  CREATE TYPE "public"."policy_target_type" AS ENUM('PRODUCT', 'SELLER', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."policy_report_reason" AS ENUM('MISLEADING_INFO', 'NOT_HANDMADE', 'PROHIBITED_ITEM', 'COPYRIGHT_INFRINGEMENT', 'ABUSIVE_BEHAVIOR', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."policy_report_status" AS ENUM('PENDING_REVIEW', 'INVESTIGATING', 'ACTION_TAKEN', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."policy_report_action" AS ENUM('NO_ACTION', 'WARNING_ISSUED', 'LISTING_REMOVED', 'SELLER_SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."risk_entity_type" AS ENUM('USER', 'ORDER', 'SELLER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."risk_signal_type" AS ENUM('VELOCITY_PAYMENT_FAILURE', 'SUSPICIOUS_CHECKOUT', 'DUPLICATE_DISPUTES', 'FULFILMENT_ANOMALY', 'MANUAL_SECURITY_FLAG');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."risk_case_status" AS ENUM('OPEN', 'UNDER_INVESTIGATION', 'MITIGATED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."risk_action_taken" AS ENUM('NONE', 'TRANSACTION_FLAGGED', 'SELLER_HOLD_REQUESTED', 'ACCOUNT_RESTRICTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."privacy_request_type" AS ENUM('DATA_ACCESS', 'DATA_CORRECTION', 'ACCOUNT_DELETION', 'CONSENT_WITHDRAWAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."privacy_request_status" AS ENUM('SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "order_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "sub_order_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "product_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "escalated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "escalation_reason" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolution_notes" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_sub_order_id_sub_orders_id_fk" FOREIGN KEY ("sub_order_id") REFERENCES "public"."sub_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_order" ON "support_tickets" USING btree ("order_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_role" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_messages_ticket" ON "support_ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_messages_created" ON "support_ticket_messages" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "customer_notes" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "seller_notes" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "evidence_urls" text[];--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolution_notes" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_number" varchar(50) NOT NULL,
	"reporter_id" uuid,
	"target_type" "public"."policy_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "public"."policy_report_reason" NOT NULL,
	"description" text NOT NULL,
	"evidence_urls" text[],
	"status" "public"."policy_report_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"assigned_reviewer_id" uuid,
	"review_notes" text,
	"action_taken" "public"."policy_report_action" DEFAULT 'NO_ACTION' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "policy_reports" ADD CONSTRAINT "policy_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "policy_reports" ADD CONSTRAINT "policy_reports_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_reports_status" ON "policy_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_reports_target" ON "policy_reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_reports_reporter" ON "policy_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "risk_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"entity_type" "public"."risk_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"signal_type" "public"."risk_signal_type" NOT NULL,
	"risk_level" "public"."risk_level" DEFAULT 'MEDIUM' NOT NULL,
	"status" "public"."risk_case_status" DEFAULT 'OPEN' NOT NULL,
	"assigned_investigator_id" uuid,
	"evidence_snapshot" jsonb,
	"internal_notes" text,
	"action_taken" "public"."risk_action_taken" DEFAULT 'NONE' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "risk_cases" ADD CONSTRAINT "risk_cases_assigned_investigator_id_users_id_fk" FOREIGN KEY ("assigned_investigator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_risk_cases_status" ON "risk_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_risk_cases_level" ON "risk_cases" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_risk_cases_entity" ON "risk_cases" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"user_id" uuid NOT NULL,
	"request_type" "public"."privacy_request_type" NOT NULL,
	"status" "public"."privacy_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"reason" text,
	"review_notes" text,
	"retention_exemptions" text,
	"assigned_to" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_privacy_requests_user" ON "privacy_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_privacy_requests_status" ON "privacy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_privacy_requests_type" ON "privacy_requests" USING btree ("request_type");
