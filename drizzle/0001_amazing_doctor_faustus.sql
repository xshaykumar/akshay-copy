CREATE TYPE "app"."assessment_status" AS ENUM('draft', 'submitted', 'reviewed', 'archived');--> statement-breakpoint
CREATE TYPE "app"."assignment_status" AS ENUM('selection', 'open_pool', 'assigned', 'replacement_pending', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."coach_approval_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "app"."consultation_status" AS ENUM('requested', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "app"."purchase_status" AS ENUM('pending', 'paid', 'active', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "app"."refund_status" AS ENUM('requested', 'approved', 'processing', 'completed', 'declined', 'failed');--> statement-breakpoint
CREATE TYPE "app"."replacement_status" AS ENUM('requested', 'reviewing', 'approved', 'declined', 'completed');--> statement-breakpoint
CREATE TYPE "app"."scheduled_job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."session_status" AS ENUM('scheduled', 'completed', 'cancelled', 'missed');--> statement-breakpoint
CREATE TABLE "app"."assessment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "app"."assessment_status" DEFAULT 'draft' NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_coach_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."client_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"preferred_language" text,
	"coaching_mode_preference" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."coach_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"coach_user_id" uuid,
	"status" "app"."assignment_status" DEFAULT 'selection' NOT NULL,
	"selection_window_ends_at" timestamp with time zone NOT NULL,
	"assigned_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."coach_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"headline" text,
	"biography" text,
	"years_experience" integer,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"coaching_modes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"location_label" text,
	"capacity" integer DEFAULT 0 NOT NULL,
	"accepting_clients" boolean DEFAULT false NOT NULL,
	"approval_status" "app"."coach_approval_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."coach_specialties" (
	"coach_user_id" uuid NOT NULL,
	"specialty" text NOT NULL,
	CONSTRAINT "coach_specialties_user_specialty_pk" PRIMARY KEY("coach_user_id","specialty")
);
--> statement-breakpoint
CREATE TABLE "app"."coaching_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "app"."session_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"preferred_date" date NOT NULL,
	"preferred_window" text NOT NULL,
	"goal_category" text NOT NULL,
	"status" "app"."consultation_status" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "conversation_participants_conversation_user_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"purchase_id" uuid,
	"consultation_id" uuid,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_reference" text,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "app"."payment_status" DEFAULT 'created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."plan_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "app"."purchase_status" DEFAULT 'pending' NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"purchased_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"coaching_mode" text NOT NULL,
	"duration_months" integer NOT NULL,
	"price_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."progress_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"private_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_order_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"amount_paise" integer NOT NULL,
	"reason_code" text NOT NULL,
	"status" "app"."refund_status" DEFAULT 'requested' NOT NULL,
	"provider_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."replacement_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"private_details" text,
	"status" "app"."replacement_status" DEFAULT 'requested' NOT NULL,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."scheduled_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"deduplication_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"status" "app"."scheduled_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."webhook_events" (
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_pk" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "app"."assessment_reports" ADD CONSTRAINT "assessment_reports_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "app"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."assessment_reports" ADD CONSTRAINT "assessment_reports_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."assessments" ADD CONSTRAINT "assessments_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."assessments" ADD CONSTRAINT "assessments_reviewed_by_coach_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_coach_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD CONSTRAINT "coach_assignments_purchase_id_plan_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "app"."plan_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD CONSTRAINT "coach_assignments_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD CONSTRAINT "coach_assignments_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coach_specialties" ADD CONSTRAINT "coach_specialties_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD CONSTRAINT "coaching_sessions_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD CONSTRAINT "coaching_sessions_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD CONSTRAINT "coaching_sessions_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."conversations" ADD CONSTRAINT "conversations_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_purchase_id_plan_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "app"."plan_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "app"."consultations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_purchases" ADD CONSTRAINT "plan_purchases_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_purchases" ADD CONSTRAINT "plan_purchases_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "app"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."progress_entries" ADD CONSTRAINT "progress_entries_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."progress_entries" ADD CONSTRAINT "progress_entries_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."refunds" ADD CONSTRAINT "refunds_payment_order_id_payment_orders_id_fk" FOREIGN KEY ("payment_order_id") REFERENCES "app"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_assignment_id_coach_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "app"."coach_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."replacement_requests" ADD CONSTRAINT "replacement_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_reports_storage_path_unique" ON "app"."assessment_reports" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "assessment_reports_assessment_idx" ON "app"."assessment_reports" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessments_client_created_idx" ON "app"."assessments" USING btree ("client_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_assignments_purchase_unique" ON "app"."coach_assignments" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "coach_assignments_client_status_idx" ON "app"."coach_assignments" USING btree ("client_user_id","status");--> statement-breakpoint
CREATE INDEX "coach_assignments_coach_status_idx" ON "app"."coach_assignments" USING btree ("coach_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_profiles_slug_unique" ON "app"."coach_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "coach_profiles_approval_availability_idx" ON "app"."coach_profiles" USING btree ("approval_status","accepting_clients");--> statement-breakpoint
CREATE INDEX "coaching_sessions_client_start_idx" ON "app"."coaching_sessions" USING btree ("client_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "coaching_sessions_coach_start_idx" ON "app"."coaching_sessions" USING btree ("coach_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "consultations_status_date_idx" ON "app"."consultations" USING btree ("status","preferred_date");--> statement-breakpoint
CREATE INDEX "conversation_participants_user_idx" ON "app"."conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_attachments_storage_path_unique" ON "app"."message_attachments" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "app"."message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "app"."messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_reference_unique" ON "app"."payment_orders" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payment_orders_user_created_idx" ON "app"."payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "plan_purchases_client_status_idx" ON "app"."plan_purchases" USING btree ("client_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_unique" ON "app"."plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "plans_active_mode_idx" ON "app"."plans" USING btree ("active","coaching_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_entries_client_date_unique" ON "app"."progress_entries" USING btree ("client_user_id","entry_date");--> statement-breakpoint
CREATE INDEX "refunds_payment_status_idx" ON "app"."refunds" USING btree ("payment_order_id","status");--> statement-breakpoint
CREATE INDEX "replacement_requests_status_created_idx" ON "app"."replacement_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_jobs_deduplication_key_unique" ON "app"."scheduled_jobs" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "scheduled_jobs_status_run_idx" ON "app"."scheduled_jobs" USING btree ("status","run_at");--> statement-breakpoint
ALTER TABLE "app"."coach_profiles"
  ADD CONSTRAINT "coach_profiles_capacity_nonnegative"
  CHECK ("capacity" >= 0);--> statement-breakpoint
ALTER TABLE "app"."plans"
  ADD CONSTRAINT "plans_price_positive"
  CHECK ("price_paise" > 0 AND "duration_months" > 0);--> statement-breakpoint
ALTER TABLE "app"."plan_purchases"
  ADD CONSTRAINT "plan_purchases_amount_positive"
  CHECK ("amount_paise" > 0);--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions"
  ADD CONSTRAINT "coaching_sessions_time_order"
  CHECK ("ends_at" > "starts_at");--> statement-breakpoint
ALTER TABLE "app"."payment_orders"
  ADD CONSTRAINT "payment_orders_amount_positive"
  CHECK ("amount_paise" > 0);--> statement-breakpoint
ALTER TABLE "app"."payment_orders"
  ADD CONSTRAINT "payment_orders_one_subject"
  CHECK (
    ("purchase_id" IS NOT NULL AND "consultation_id" IS NULL)
    OR
    ("purchase_id" IS NULL AND "consultation_id" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "app"."refunds"
  ADD CONSTRAINT "refunds_amount_positive"
  CHECK ("amount_paise" > 0);--> statement-breakpoint
REVOKE ALL ON TABLE
  "app"."assessment_reports",
  "app"."assessments",
  "app"."client_profiles",
  "app"."coach_assignments",
  "app"."coach_profiles",
  "app"."coach_specialties",
  "app"."coaching_sessions",
  "app"."consultations",
  "app"."conversation_participants",
  "app"."conversations",
  "app"."message_attachments",
  "app"."messages",
  "app"."payment_orders",
  "app"."plan_purchases",
  "app"."plans",
  "app"."progress_entries",
  "app"."refunds",
  "app"."replacement_requests",
  "app"."scheduled_jobs",
  "app"."webhook_events"
FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "app"."assessment_reports",
  "app"."assessments",
  "app"."client_profiles",
  "app"."coach_assignments",
  "app"."coach_profiles",
  "app"."coach_specialties",
  "app"."coaching_sessions",
  "app"."consultations",
  "app"."conversation_participants",
  "app"."conversations",
  "app"."message_attachments",
  "app"."messages",
  "app"."payment_orders",
  "app"."plan_purchases",
  "app"."plans",
  "app"."progress_entries",
  "app"."refunds",
  "app"."replacement_requests",
  "app"."scheduled_jobs"
TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
  "app"."webhook_events"
TO app_runtime;--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assessment_reports',
    'assessments',
    'client_profiles',
    'coach_assignments',
    'coach_profiles',
    'coach_specialties',
    'coaching_sessions',
    'consultations',
    'conversation_participants',
    'conversations',
    'message_attachments',
    'messages',
    'payment_orders',
    'plan_purchases',
    'plans',
    'progress_entries',
    'refunds',
    'replacement_requests',
    'scheduled_jobs',
    'webhook_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON app.%I FOR ALL TO app_runtime USING (true) WITH CHECK (true)',
      'app_runtime_' || table_name,
      table_name
    );
  END LOOP;
END
$$;--> statement-breakpoint
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'assessment-reports',
    'assessment-reports',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  ),
  (
    'chat-attachments',
    'chat-attachments',
    false,
    5242880,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
  )
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
