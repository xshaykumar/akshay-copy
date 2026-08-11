ALTER TABLE "app"."plans" DROP CONSTRAINT "plans_duration_days_valid";--> statement-breakpoint
ALTER TABLE "app"."plans" DROP CONSTRAINT "plans_price_positive";--> statement-breakpoint
ALTER TABLE "app"."plans" ALTER COLUMN "duration_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."plans" DROP COLUMN "duration_months";--> statement-breakpoint
ALTER TABLE "app"."plans" ADD CONSTRAINT "plans_duration_days_valid" CHECK ("app"."plans"."duration_days" in (30, 60, 90));--> statement-breakpoint
ALTER TABLE "app"."plans" ADD CONSTRAINT "plans_price_positive" CHECK ("app"."plans"."price_paise" > 0 AND "app"."plans"."duration_days" > 0);
