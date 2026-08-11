ALTER TABLE "app"."coach_activation_payments" ADD COLUMN "payment_order_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "purpose" text DEFAULT 'plan_purchase' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "provider_signature" text;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "receipt" text;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "app"."webhook_events" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."webhook_events" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."webhook_events" ADD COLUMN "processing_error_code" text;--> statement-breakpoint
UPDATE "app"."payment_orders"
SET "purpose" = CASE
  WHEN "purchase_id" IS NOT NULL THEN 'plan_purchase'
  WHEN "consultation_id" IS NOT NULL THEN 'legacy_consultation'
  ELSE "purpose"
END;--> statement-breakpoint
UPDATE "app"."payment_orders"
SET "captured_at" = COALESCE("updated_at", "created_at")
WHERE "status" = 'captured'
  AND "captured_at" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_payment_order_id_payment_orders_id_fk" FOREIGN KEY ("payment_order_id") REFERENCES "app"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_activation_payments_order_unique" ON "app"."coach_activation_payments" USING btree ("payment_order_id") WHERE "app"."coach_activation_payments"."payment_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_payment_unique" ON "app"."payment_orders" USING btree ("provider","provider_payment_id") WHERE "app"."payment_orders"."provider_payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_receipt_unique" ON "app"."payment_orders" USING btree ("provider","receipt") WHERE "app"."payment_orders"."receipt" is not null;--> statement-breakpoint
CREATE INDEX "payment_orders_user_purpose_status_idx" ON "app"."payment_orders" USING btree ("user_id","purpose","status");--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_amount_nonnegative" CHECK ("app"."payment_orders"."amount_paise" >= 0);--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_purpose_valid" CHECK ("app"."payment_orders"."purpose" in ('plan_purchase', 'coach_activation', 'legacy_consultation'));--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_subject_valid" CHECK ((
        "app"."payment_orders"."purpose" = 'plan_purchase'
        and "app"."payment_orders"."purchase_id" is not null
        and "app"."payment_orders"."consultation_id" is null
      ) or (
        "app"."payment_orders"."purpose" = 'coach_activation'
        and "app"."payment_orders"."purchase_id" is null
        and "app"."payment_orders"."consultation_id" is null
        and "app"."payment_orders"."user_id" is not null
      ) or (
        "app"."payment_orders"."purpose" = 'legacy_consultation'
        and "app"."payment_orders"."purchase_id" is null
        and "app"."payment_orders"."consultation_id" is not null
      )) NOT VALID;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_capture_timestamp_valid" CHECK ("app"."payment_orders"."status" <> 'captured' or "app"."payment_orders"."captured_at" is not null);
