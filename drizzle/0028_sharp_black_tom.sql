ALTER TABLE "app"."coach_assignments" ADD COLUMN "client_available_days" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coach_assignments" ADD COLUMN "client_preferred_time" text;
--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" DROP CONSTRAINT IF EXISTS "coach_profiles_available_time_slots_valid";
--> statement-breakpoint
UPDATE "app"."coach_profiles" AS profile
SET "available_time_slots" = converted.slots,
    "updated_at" = NOW()
FROM (
  SELECT
    source."user_id",
    ARRAY_AGG(DISTINCT expanded.slot ORDER BY expanded.slot) AS slots
  FROM "app"."coach_profiles" AS source
  CROSS JOIN LATERAL UNNEST(source."available_time_slots") AS original(slot)
  CROSS JOIN LATERAL UNNEST(
    CASE original.slot
      WHEN '09:00-12:00' THEN ARRAY['09:00-10:00', '10:00-11:00', '11:00-12:00']::text[]
      WHEN '13:00-16:00' THEN ARRAY['13:00-14:00', '14:00-15:00', '15:00-16:00']::text[]
      WHEN '17:00-20:00' THEN ARRAY['17:00-18:00', '18:00-19:00', '19:00-20:00']::text[]
      ELSE ARRAY[original.slot]::text[]
    END
  ) AS expanded(slot)
  GROUP BY source."user_id"
) AS converted
WHERE profile."user_id" = converted."user_id"
  AND profile."available_time_slots" && ARRAY['09:00-12:00', '13:00-16:00', '17:00-20:00']::text[];
--> statement-breakpoint
ALTER TABLE "app"."coach_profiles" ADD CONSTRAINT "coach_profiles_available_time_slots_valid" CHECK (
  "available_time_slots" <@ ARRAY[
    '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
    '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
    '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
    '18:00-19:00', '19:00-20:00'
  ]::text[]
);
