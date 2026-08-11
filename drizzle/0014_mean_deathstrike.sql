DROP INDEX "app"."consultations_status_date_idx";--> statement-breakpoint
ALTER TABLE "app"."consultations" ALTER COLUMN "contact_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."consultations" ALTER COLUMN "preferred_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."consultations" ALTER COLUMN "preferred_window" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "consultations_status_date_idx" ON "app"."consultations" USING btree ("status","created_at");