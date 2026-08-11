-- Retain historical purchases while removing the temporary plan from every
-- active catalogue and checkout query.
UPDATE "app"."plans"
SET "active" = false,
    "updated_at" = NOW()
WHERE "code" = 'temporary-free-flow-90';
