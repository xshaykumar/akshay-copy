ALTER TABLE "app"."coach_activation_payments" ADD COLUMN "duration_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD COLUMN "activation_duration_days" integer;--> statement-breakpoint
UPDATE "app"."payment_orders"
SET "activation_duration_days" = 30
WHERE "purpose" = 'coach_activation'
	AND "activation_duration_days" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_duration_valid" CHECK ("app"."coach_activation_payments"."duration_days" in (30, 180, 365));--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_activation_duration_valid" CHECK ((
        "app"."payment_orders"."purpose" = 'coach_activation'
        and "app"."payment_orders"."activation_duration_days" is not null
        and "app"."payment_orders"."activation_duration_days" in (30, 180, 365)
      ) or (
        "app"."payment_orders"."purpose" <> 'coach_activation'
        and "app"."payment_orders"."activation_duration_days" is null
      ));
