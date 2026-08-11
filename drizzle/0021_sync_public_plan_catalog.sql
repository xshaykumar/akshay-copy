-- Provision every commercial plan and duration shown on the public pricing
-- page. Prices use the same 30-day cycle rates and duration discounts as
-- lib/plans/public-catalog.ts. The upsert is safe for repeat deployment and
-- keeps historical purchases linked to stable plan codes.
WITH plan_catalog (
	"slug",
	"name",
	"description",
	"coaching_mode",
	"cycle_rate_paise",
	"discount_90",
	"discount_180",
	"discount_365",
	"features"
) AS (
	VALUES
		(
			'online-basic',
			'Online Basic',
			'Foundational online coaching with one live session each week.',
			'Online',
			500000,
			10,
			15,
			20,
			'["1 live session with your coach every week", "Personalized workout and diet plans", "Weekly progress check-in", "Exercise technique review", "Progress review during coaching sessions"]'::jsonb
		),
		(
			'online-plus',
			'Online Plus',
			'High-touch online coaching with four live sessions each week.',
			'Online',
			800000,
			10,
			15,
			20,
			'["4 live sessions every week", "Personalized workout and nutrition programs", "Weekly progress tracking", "Exercise technique analysis", "Priority coaching support"]'::jsonb
		),
		(
			'online-elite',
			'Online Elite',
			'Advanced online coaching with live support six days each week.',
			'Online',
			1000000,
			10,
			15,
			20,
			'["Live coaching 6 days every week", "Unlimited workout adjustments", "Personalized nutrition", "Advanced performance programming", "Weekly progress review and highest-priority support"]'::jsonb
		),
		(
			'group-online-coaching',
			'Group Online Coaching',
			'Coach-led online group sessions with no more than 20 active members.',
			'Online',
			400000,
			10,
			15,
			20,
			'["Live group sessions", "Nutrition guidance", "Community support", "Progress tracking", "Assessment during every 30-day cycle"]'::jsonb
		),
		(
			'offline-personal-training',
			'Offline Personal Training',
			'One-to-one personal training delivered at a gym or the client home.',
			'Offline',
			2500000,
			12,
			16,
			20,
			'["One-to-one personal training", "Gym or home training", "Performance testing", "Mobility and recovery", "Nutrition guidance and progress monitoring"]'::jsonb
		),
		(
			'athlete-executive',
			'Athlete / Executive Performance',
			'Dedicated offline performance coaching. Travel, accommodation and food are provided by the client.',
			'Offline',
			15000000,
			14,
			18,
			25,
			'["Dedicated performance coach", "Flexible daily training schedule", "Strength, conditioning, and sports nutrition", "Recovery, mobility, and rehabilitation planning", "Performance analysis and competition preparation", "Lifestyle management"]'::jsonb
		)
),
duration_catalog ("duration_days", "cycles") AS (
	VALUES (90, 3), (180, 6), (365, 12)
)
INSERT INTO "app"."plans" (
	"code",
	"name",
	"description",
	"coaching_mode",
	"duration_days",
	"price_paise",
	"currency",
	"features",
	"active"
)
SELECT
	plan_catalog."slug" || '-' || duration_catalog."duration_days"::text,
	plan_catalog."name",
	plan_catalog."description",
	plan_catalog."coaching_mode",
	duration_catalog."duration_days",
	(
		plan_catalog."cycle_rate_paise"::bigint
		* duration_catalog."cycles"
		* (
			100 - CASE duration_catalog."duration_days"
				WHEN 90 THEN plan_catalog."discount_90"
				WHEN 180 THEN plan_catalog."discount_180"
				ELSE plan_catalog."discount_365"
			END
		)
		/ 100
	)::integer,
	'INR',
	plan_catalog."features",
	true
FROM plan_catalog
CROSS JOIN duration_catalog
ON CONFLICT ("code") DO UPDATE SET
	"name" = EXCLUDED."name",
	"description" = EXCLUDED."description",
	"coaching_mode" = EXCLUDED."coaching_mode",
	"duration_days" = EXCLUDED."duration_days",
	"price_paise" = EXCLUDED."price_paise",
	"currency" = EXCLUDED."currency",
	"features" = EXCLUDED."features",
	"active" = true,
	"updated_at" = now();
