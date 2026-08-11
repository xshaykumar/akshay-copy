ALTER TABLE "app"."payment_orders"
	DROP CONSTRAINT IF EXISTS "payment_orders_one_subject";

ALTER TABLE "app"."payment_orders"
	VALIDATE CONSTRAINT "payment_orders_subject_valid";
