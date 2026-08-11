UPDATE "app"."coach_profiles" AS "profile"
SET
	"certification_waived_at" = "manual_grant"."created_at",
	"certification_waived_by_user_id" = "manual_grant"."actor_user_id",
	"updated_at" = GREATEST("profile"."updated_at", "manual_grant"."created_at")
FROM (
	SELECT DISTINCT ON ("target_id")
		"target_id",
		"actor_user_id",
		"created_at"
	FROM "app"."audit_logs"
	WHERE "action" = 'admin.coach_activated'
		AND "target_type" = 'user'
		AND "target_id" IS NOT NULL
	ORDER BY "target_id", "created_at" DESC
) AS "manual_grant"
WHERE "profile"."user_id" = "manual_grant"."target_id"
	AND "profile"."certification_waived_at" IS NULL;
