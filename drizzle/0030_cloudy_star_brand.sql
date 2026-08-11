ALTER TABLE "app"."coach_activation_payments" DROP CONSTRAINT "coach_activation_payments_duration_valid";--> statement-breakpoint
ALTER TABLE "app"."payment_orders" DROP CONSTRAINT "payment_orders_activation_duration_valid";--> statement-breakpoint
ALTER TABLE "app"."coach_activation_payments" ADD CONSTRAINT "coach_activation_payments_duration_valid" CHECK ("app"."coach_activation_payments"."duration_days" in (30, 90, 365)) NOT VALID;--> statement-breakpoint
ALTER TABLE "app"."payment_orders" ADD CONSTRAINT "payment_orders_activation_duration_valid" CHECK ((
        "app"."payment_orders"."purpose" = 'coach_activation'
        and "app"."payment_orders"."activation_duration_days" is not null
        and "app"."payment_orders"."activation_duration_days" in (30, 90, 365)
      ) or (
        "app"."payment_orders"."purpose" <> 'coach_activation'
        and "app"."payment_orders"."activation_duration_days" is null
      )) NOT VALID;
