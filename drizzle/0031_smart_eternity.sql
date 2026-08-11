CREATE TABLE "app"."plan_upgrades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"client_user_id" uuid NOT NULL,
	"from_plan_id" uuid NOT NULL,
	"to_plan_id" uuid NOT NULL,
	"payment_order_id" uuid,
	"status" text DEFAULT 'payment_pending' NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"applicable_cycles" integer NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_upgrades_status_valid" CHECK ("app"."plan_upgrades"."status" in ('payment_pending', 'scheduled', 'applied', 'cancelled')),
	CONSTRAINT "plan_upgrades_amount_positive" CHECK ("app"."plan_upgrades"."amount_paise" > 0),
	CONSTRAINT "plan_upgrades_cycles_positive" CHECK ("app"."plan_upgrades"."applicable_cycles" > 0),
	CONSTRAINT "plan_upgrades_distinct_plans" CHECK ("app"."plan_upgrades"."from_plan_id" <> "app"."plan_upgrades"."to_plan_id")
);
--> statement-breakpoint
ALTER TABLE "app"."payment_orders" DROP CONSTRAINT "payment_orders_purpose_valid";--> statement-breakpoint
ALTER TABLE "app"."payment_orders" DROP CONSTRAINT "payment_orders_subject_valid";--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ADD CONSTRAINT "plan_upgrades_purchase_id_plan_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "app"."plan_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ADD CONSTRAINT "plan_upgrades_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ADD CONSTRAINT "plan_upgrades_from_plan_id_plans_id_fk" FOREIGN KEY ("from_plan_id") REFERENCES "app"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ADD CONSTRAINT "plan_upgrades_to_plan_id_plans_id_fk" FOREIGN KEY ("to_plan_id") REFERENCES "app"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ADD CONSTRAINT "plan_upgrades_payment_order_id_payment_orders_id_fk" FOREIGN KEY ("payment_order_id") REFERENCES "app"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_upgrades_payment_order_unique" ON "app"."plan_upgrades" USING btree ("payment_order_id") WHERE "app"."plan_upgrades"."payment_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_upgrades_purchase_current_unique" ON "app"."plan_upgrades" USING btree ("purchase_id") WHERE "app"."plan_upgrades"."status" in ('payment_pending', 'scheduled', 'applied');--> statement-breakpoint
CREATE INDEX "plan_upgrades_status_effective_idx" ON "app"."plan_upgrades" USING btree ("status","effective_at");--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_purpose_valid" CHECK ("app"."payment_orders"."purpose" in ('plan_purchase', 'plan_upgrade', 'coach_activation', 'legacy_consultation'));--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_subject_valid" CHECK ((
        "app"."payment_orders"."purpose" = 'plan_purchase'
        and "app"."payment_orders"."purchase_id" is not null
        and "app"."payment_orders"."consultation_id" is null
      ) or (
        "app"."payment_orders"."purpose" = 'plan_upgrade'
        and "app"."payment_orders"."purchase_id" is not null
        and "app"."payment_orders"."consultation_id" is null
        and "app"."payment_orders"."user_id" is not null
      ) or (
        "app"."payment_orders"."purpose" = 'coach_activation'
        and "app"."payment_orders"."purchase_id" is null
        and "app"."payment_orders"."consultation_id" is null
        and "app"."payment_orders"."user_id" is not null
      ) or (
        "app"."payment_orders"."purpose" = 'legacy_consultation'
        and "app"."payment_orders"."purchase_id" is null
        and "app"."payment_orders"."consultation_id" is not null
      ));
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."plan_upgrades" FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "app"."plan_upgrades" TO app_runtime;
--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."plan_upgrades" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "app_runtime_plan_upgrades" ON "app"."plan_upgrades"
  FOR ALL TO app_runtime USING (true) WITH CHECK (true);
