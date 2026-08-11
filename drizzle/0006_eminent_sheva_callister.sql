ALTER TABLE "app"."coaching_sessions" ADD COLUMN "meeting_provider" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD COLUMN "provider_room_id" text;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD COLUMN "rescheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD COLUMN "cancelled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "app"."coaching_sessions" ADD CONSTRAINT "coaching_sessions_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_sessions_provider_room_unique" ON "app"."coaching_sessions" USING btree ("meeting_provider","provider_room_id") WHERE "app"."coaching_sessions"."provider_room_id" is not null;