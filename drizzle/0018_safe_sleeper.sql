ALTER TABLE "app"."coach_certifications" ADD COLUMN "qualification_title" text;--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD COLUMN "athlete_executive_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "app"."coach_profiles" AS "profile"
SET "athlete_executive_eligible" = EXISTS (
	SELECT 1
	FROM "app"."coach_certifications" AS "certification"
	WHERE "certification"."coach_user_id" = "profile"."user_id"
		AND "certification"."verification_status" = 'approved'
		AND "certification"."qualification_type" <> 'other'
);
