ALTER TABLE "app"."consultations" ADD COLUMN "contact_phone" text;
--> statement-breakpoint
UPDATE "app"."consultations"
SET "contact_phone" = 'not_provided'
WHERE "contact_phone" IS NULL;
--> statement-breakpoint
ALTER TABLE "app"."consultations" ALTER COLUMN "contact_phone" SET NOT NULL;
