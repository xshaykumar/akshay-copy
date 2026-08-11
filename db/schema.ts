import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const app = pgSchema("app");

export const accountStatus = app.enum("account_status", [
  "pending_verification",
  "active",
  "suspended",
  "closed",
]);

export const applicationRole = app.enum("application_role", [
  "client",
  "coach",
  "admin",
]);

export const coachApprovalStatus = app.enum("coach_approval_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "suspended",
]);

export const coachCertificationStatus = app.enum(
  "coach_certification_status",
  ["draft", "submitted", "approved", "rejected"],
);

export const purchaseStatus = app.enum("purchase_status", [
  "pending",
  "paid",
  "active",
  "completed",
  "cancelled",
  "refunded",
]);

export const assignmentStatus = app.enum("assignment_status", [
  "selection",
  "open_pool",
  "assigned",
  "replacement_pending",
  "ended",
  "cancelled",
]);

export const assessmentStatus = app.enum("assessment_status", [
  "draft",
  "submitted",
  "reviewed",
  "archived",
]);

export const sessionStatus = app.enum("session_status", [
  "scheduled",
  "completed",
  "cancelled",
  "missed",
]);

export const consultationStatus = app.enum("consultation_status", [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
]);

export const replacementStatus = app.enum("replacement_status", [
  "requested",
  "reviewing",
  "approved",
  "declined",
  "completed",
]);

export const serviceCycleStatus = app.enum("service_cycle_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const cyclePayoutStatus = app.enum("cycle_payout_status", [
  "available",
  "paid",
  "cancelled",
]);

export const paymentStatus = app.enum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const refundStatus = app.enum("refund_status", [
  "requested",
  "approved",
  "processing",
  "completed",
  "declined",
  "failed",
]);

export const scheduledJobStatus = app.enum("scheduled_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const users = app.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").notNull(),
    username: text("username").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    displayName: text("display_name").notNull(),
    contactPhone: text("contact_phone"),
    status: accountStatus("status").default("pending_verification").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_auth_user_id_unique").on(table.authUserId),
    uniqueIndex("users_normalized_username_unique").on(
      table.normalizedUsername,
    ),
    index("users_status_idx").on(table.status),
  ],
);

export const userRoles = app.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: applicationRole("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    primaryKey({
      name: "user_roles_user_id_role_pk",
      columns: [table.userId, table.role],
    }),
    index("user_roles_role_idx").on(table.role),
  ],
);

export const clientProfiles = app.table("client_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").default("Asia/Kolkata").notNull(),
  locationState: text("location_state"),
  locationCity: text("location_city"),
  locationDistrict: text("location_district"),
  preferredLanguage: text("preferred_language"),
  coachingModePreference: text("coaching_mode_preference"),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const profilePhotos = app.table(
  "profile_photos",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("profile_photos_storage_path_unique").on(table.storagePath),
  ],
);

export const coachProfiles = app.table(
  "coach_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    headline: text("headline"),
    biography: text("biography"),
    yearsExperience: integer("years_experience"),
    languages: text("languages").array().default(sql`ARRAY[]::text[]`).notNull(),
    coachingModes: text("coaching_modes")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    locationLabel: text("location_label"),
    capacity: integer("capacity").default(0).notNull(),
    acceptingClients: boolean("accepting_clients").default(false).notNull(),
    approvalStatus: coachApprovalStatus("approval_status")
      .default("draft")
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    certificationWaivedAt: timestamp("certification_waived_at", {
      withTimezone: true,
    }),
    certificationWaivedByUserId: uuid(
      "certification_waived_by_user_id",
    ).references(() => users.id, { onDelete: "set null" }),
    rejectionReason: text("rejection_reason"),
    certificationReviewMessage: text("certification_review_message"),
    certificationSubmittedAt: timestamp("certification_submitted_at", {
      withTimezone: true,
    }),
    athleteExecutiveEligible: boolean("athlete_executive_eligible")
      .default(false)
      .notNull(),
    availableDays: text("available_days")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    availableTimeSlots: text("available_time_slots")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    locationState: text("location_state"),
    locationCity: text("location_city"),
    locationDistrict: text("location_district"),
    activationExpiresAt: timestamp("activation_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_profiles_slug_unique").on(table.slug),
    index("coach_profiles_approval_availability_idx").on(
      table.approvalStatus,
      table.acceptingClients,
    ),
    index("coach_profiles_activation_availability_idx").on(
      table.approvedAt,
      table.certificationWaivedAt,
      table.activationExpiresAt,
      table.acceptingClients,
    ),
  ],
);

export const coachCertifications = app.table(
  "coach_certifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    qualificationType: text("qualification_type").notNull(),
    qualificationTitle: text("qualification_title"),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    verificationStatus: coachCertificationStatus("verification_status")
      .default("draft")
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_certifications_user_qualification_unique").on(
      table.coachUserId,
      table.qualificationType,
    ),
    uniqueIndex("coach_certifications_storage_path_unique").on(
      table.storagePath,
    ),
    index("coach_certifications_coach_idx").on(table.coachUserId),
  ],
);

export const coachActivationPayments = app.table(
  "coach_activation_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentOrderId: uuid("payment_order_id").references(
      () => paymentOrders.id,
      { onDelete: "restrict" },
    ),
    provider: text("provider").default("testing").notNull(),
    providerReference: text("provider_reference"),
    amountPaise: integer("amount_paise").notNull(),
    durationDays: integer("duration_days").default(30).notNull(),
    currency: text("currency").default("INR").notNull(),
    status: paymentStatus("status").default("captured").notNull(),
    periodStartsAt: timestamp("period_starts_at", { withTimezone: true })
      .notNull(),
    periodEndsAt: timestamp("period_ends_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_activation_payments_provider_reference_unique").on(
      table.provider,
      table.providerReference,
    ),
    uniqueIndex("coach_activation_payments_order_unique")
      .on(table.paymentOrderId)
      .where(sql`${table.paymentOrderId} is not null`),
    index("coach_activation_payments_coach_period_idx").on(
      table.coachUserId,
      table.periodEndsAt,
    ),
    check(
      "coach_activation_payments_duration_valid",
      sql`${table.durationDays} in (30, 90, 365)`,
    ),
  ],
);

export const coachSpecialties = app.table(
  "coach_specialties",
  {
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    specialty: text("specialty").notNull(),
  },
  (table) => [
    primaryKey({
      name: "coach_specialties_user_specialty_pk",
      columns: [table.coachUserId, table.specialty],
    }),
  ],
);

export const plans = app.table(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    coachingMode: text("coaching_mode").notNull(),
    durationDays: integer("duration_days").notNull(),
    pricePaise: integer("price_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    features: jsonb("features").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("plans_code_unique").on(table.code),
    index("plans_active_mode_idx").on(table.active, table.coachingMode),
    check(
      "plans_duration_days_valid",
      sql`${table.durationDays} in (90, 180, 365)`,
    ),
    check(
      "plans_price_nonnegative",
      sql`${table.pricePaise} >= 0`,
    ),
  ],
);

export const planPurchases = app.table(
  "plan_purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: purchaseStatus("status").default("pending").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("plan_purchases_client_status_idx").on(
      table.clientUserId,
      table.status,
    ),
  ],
);

export const assessments = app.table(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    version: integer("version").default(1).notNull(),
    status: assessmentStatus("status").default("draft").notNull(),
    responses: jsonb("responses")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedByCoachUserId: uuid("reviewed_by_coach_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("assessments_client_version_unique").on(
      table.clientUserId,
      table.version,
    ),
    index("assessments_client_created_idx").on(
      table.clientUserId,
      table.createdAt,
    ),
  ],
);

export const assessmentReports = app.table(
  "assessment_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("assessment_reports_storage_path_unique").on(table.storagePath),
    index("assessment_reports_assessment_idx").on(table.assessmentId),
  ],
);

export const coachAssignments = app.table(
  "coach_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => planPurchases.id, { onDelete: "restrict" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    coachUserId: uuid("coach_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    clientAvailableDays: text("client_available_days")
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    clientPreferredTime: text("client_preferred_time"),
    status: assignmentStatus("status").default("selection").notNull(),
    selectionWindowEndsAt: timestamp("selection_window_ends_at", {
      withTimezone: true,
    }).notNull(),
    applicationWindowEndsAt: timestamp("application_window_ends_at", {
      withTimezone: true,
    }),
    cycleNumber: integer("cycle_number").default(1).notNull(),
    refundEligibleAt: timestamp("refund_eligible_at", {
      withTimezone: true,
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_assignments_purchase_unique").on(table.purchaseId),
    index("coach_assignments_client_status_idx").on(
      table.clientUserId,
      table.status,
    ),
    index("coach_assignments_coach_status_idx").on(
      table.coachUserId,
      table.status,
    ),
    index("coach_assignments_selection_deadline_idx").on(
      table.status,
      table.selectionWindowEndsAt,
    ),
    index("coach_assignments_application_deadline_idx").on(
      table.status,
      table.applicationWindowEndsAt,
    ),
  ],
);

export const coachSelectionRequests = app.table(
  "coach_selection_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "cascade" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    selectionRound: integer("selection_round").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_selection_requests_coach_round_unique").on(
      table.assignmentId,
      table.coachUserId,
      table.selectionRound,
    ),
    index("coach_selection_requests_assignment_round_status_idx").on(
      table.assignmentId,
      table.selectionRound,
      table.status,
    ),
    index("coach_selection_requests_coach_status_expiry_idx").on(
      table.coachUserId,
      table.status,
      table.expiresAt,
    ),
    check(
      "coach_selection_requests_round_valid",
      sql`${table.selectionRound} > 0`,
    ),
    check(
      "coach_selection_requests_status_valid",
      sql`${table.status} in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')`,
    ),
  ],
);

export const serviceCycles = app.table(
  "service_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => planPurchases.id, { onDelete: "restrict" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "restrict" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    coachUserId: uuid("coach_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    cycleNumber: integer("cycle_number").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: serviceCycleStatus("status").default("scheduled").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("service_cycles_purchase_number_unique").on(
      table.purchaseId,
      table.cycleNumber,
    ),
    index("service_cycles_assignment_status_idx").on(
      table.assignmentId,
      table.status,
    ),
    index("service_cycles_status_end_idx").on(table.status, table.endsAt),
    check(
      "service_cycles_number_valid",
      sql`${table.cycleNumber} between 1 and 12`,
    ),
    check("service_cycles_period_valid", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const coachCyclePayouts = app.table(
  "coach_cycle_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceCycleId: uuid("service_cycle_id")
      .notNull()
      .references(() => serviceCycles.id, { onDelete: "restrict" }),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => planPurchases.id, { onDelete: "restrict" }),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: cyclePayoutStatus("status").default("available").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("coach_cycle_payouts_cycle_unique").on(table.serviceCycleId),
    index("coach_cycle_payouts_coach_status_idx").on(
      table.coachUserId,
      table.status,
    ),
    check("coach_cycle_payouts_amount_valid", sql`${table.amountPaise} > 0`),
  ],
);

export const coachingSessions = app.table(
  "coaching_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "cascade" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    mode: text("mode").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatus("status").default("scheduled").notNull(),
    meetingProvider: text("meeting_provider")
      .default("unconfigured")
      .notNull(),
    providerRoomId: text("provider_room_id"),
    rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("coaching_sessions_client_start_idx").on(
      table.clientUserId,
      table.startsAt,
    ),
    index("coaching_sessions_coach_start_idx").on(
      table.coachUserId,
      table.startsAt,
    ),
    uniqueIndex("coaching_sessions_provider_room_unique")
      .on(table.meetingProvider, table.providerRoomId)
      .where(sql`${table.providerRoomId} is not null`),
  ],
);

export const coachingGroups = app.table(
  "coaching_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("coaching_groups_coach_idx").on(table.coachUserId),
    check("coaching_groups_name_length", sql`char_length(trim(${table.name})) between 2 and 80`),
  ],
);

export const coachingGroupMembers = app.table(
  "coaching_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => coachingGroups.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "cascade" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "coaching_group_members_group_assignment_pk",
      columns: [table.groupId, table.assignmentId],
    }),
    uniqueIndex("coaching_group_members_assignment_unique").on(
      table.assignmentId,
    ),
    index("coaching_group_members_client_idx").on(table.clientUserId),
  ],
);

export const coachingGroupSessions = app.table(
  "coaching_group_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => coachingGroups.id, { onDelete: "cascade" }),
    coachUserId: uuid("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatus("status").default("scheduled").notNull(),
    meetingProvider: text("meeting_provider")
      .default("google_meet")
      .notNull(),
    providerRoomId: text("provider_room_id").notNull(),
    rescheduledAt: timestamp("rescheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("coaching_group_sessions_group_start_idx").on(
      table.groupId,
      table.startsAt,
    ),
    index("coaching_group_sessions_coach_start_idx").on(
      table.coachUserId,
      table.startsAt,
    ),
    uniqueIndex("coaching_group_sessions_provider_room_unique").on(
      table.meetingProvider,
      table.providerRoomId,
    ),
    check(
      "coaching_group_sessions_period_valid",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);

export const progressEntries = app.table(
  "progress_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "cascade" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    entryDate: date("entry_date").notNull(),
    metrics: jsonb("metrics")
      .$type<Record<string, number | string | boolean | null>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    privateNote: text("private_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("progress_entries_client_date_unique").on(
      table.clientUserId,
      table.entryDate,
    ),
  ],
);

export const conversations = app.table("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id").references(() => coachAssignments.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversationParticipants = app.table(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      name: "conversation_participants_conversation_user_pk",
      columns: [table.conversationId, table.userId],
    }),
    index("conversation_participants_user_idx").on(table.userId),
  ],
);

export const messages = app.table(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const messageAttachments = app.table(
  "message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("message_attachments_storage_path_unique").on(
      table.storagePath,
    ),
    index("message_attachments_message_idx").on(table.messageId),
  ],
);

export const consultations = app.table(
  "consultations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientUserId: uuid("client_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone").notNull(),
    preferredDate: date("preferred_date"),
    preferredWindow: text("preferred_window"),
    goalCategory: text("goal_category").notNull(),
    status: consultationStatus("status").default("requested").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("consultations_status_date_idx").on(table.status, table.createdAt),
  ],
);

export const paymentOrders = app.table(
  "payment_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    purchaseId: uuid("purchase_id").references(() => planPurchases.id, {
      onDelete: "restrict",
    }),
    consultationId: uuid("consultation_id").references(() => consultations.id, {
      onDelete: "restrict",
    }),
    purpose: text("purpose").default("plan_purchase").notNull(),
    activationDurationDays: integer("activation_duration_days"),
    provider: text("provider").default("mock").notNull(),
    providerReference: text("provider_reference"),
    providerPaymentId: text("provider_payment_id"),
    providerSignature: text("provider_signature"),
    receipt: text("receipt"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: paymentStatus("status").default("created").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_orders_provider_reference_unique").on(
      table.provider,
      table.providerReference,
    ),
    uniqueIndex("payment_orders_provider_payment_unique")
      .on(table.provider, table.providerPaymentId)
      .where(sql`${table.providerPaymentId} is not null`),
    uniqueIndex("payment_orders_provider_receipt_unique")
      .on(table.provider, table.receipt)
      .where(sql`${table.receipt} is not null`),
    index("payment_orders_user_created_idx").on(table.userId, table.createdAt),
    index("payment_orders_user_purpose_status_idx").on(
      table.userId,
      table.purpose,
      table.status,
    ),
    check("payment_orders_amount_nonnegative", sql`${table.amountPaise} >= 0`),
    check(
      "payment_orders_purpose_valid",
      sql`${table.purpose} in ('plan_purchase', 'plan_upgrade', 'coach_activation', 'legacy_consultation')`,
    ),
    check(
      "payment_orders_subject_valid",
      sql`(
        ${table.purpose} = 'plan_purchase'
        and ${table.purchaseId} is not null
        and ${table.consultationId} is null
      ) or (
        ${table.purpose} = 'plan_upgrade'
        and ${table.purchaseId} is not null
        and ${table.consultationId} is null
        and ${table.userId} is not null
      ) or (
        ${table.purpose} = 'coach_activation'
        and ${table.purchaseId} is null
        and ${table.consultationId} is null
        and ${table.userId} is not null
      ) or (
        ${table.purpose} = 'legacy_consultation'
        and ${table.purchaseId} is null
        and ${table.consultationId} is not null
      )`,
    ),
    check(
      "payment_orders_activation_duration_valid",
      sql`(
        ${table.purpose} = 'coach_activation'
        and ${table.activationDurationDays} is not null
        and ${table.activationDurationDays} in (30, 90, 365)
      ) or (
        ${table.purpose} <> 'coach_activation'
        and ${table.activationDurationDays} is null
      )`,
    ),
    check(
      "payment_orders_capture_timestamp_valid",
      sql`${table.status} <> 'captured' or ${table.capturedAt} is not null`,
    ),
  ],
);

export const planUpgrades = app.table(
  "plan_upgrades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => planPurchases.id, { onDelete: "restrict" }),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    fromPlanId: uuid("from_plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    toPlanId: uuid("to_plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    paymentOrderId: uuid("payment_order_id").references(
      () => paymentOrders.id,
      { onDelete: "restrict" },
    ),
    status: text("status").default("payment_pending").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    applicableCycles: integer("applicable_cycles").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("plan_upgrades_payment_order_unique")
      .on(table.paymentOrderId)
      .where(sql`${table.paymentOrderId} is not null`),
    uniqueIndex("plan_upgrades_purchase_current_unique")
      .on(table.purchaseId)
      .where(
        sql`${table.status} in ('payment_pending', 'scheduled', 'applied')`,
      ),
    index("plan_upgrades_status_effective_idx").on(
      table.status,
      table.effectiveAt,
    ),
    check(
      "plan_upgrades_status_valid",
      sql`${table.status} in ('payment_pending', 'scheduled', 'applied', 'cancelled')`,
    ),
    check("plan_upgrades_amount_positive", sql`${table.amountPaise} > 0`),
    check(
      "plan_upgrades_cycles_positive",
      sql`${table.applicableCycles} > 0`,
    ),
    check(
      "plan_upgrades_distinct_plans",
      sql`${table.fromPlanId} <> ${table.toPlanId}`,
    ),
  ],
);

export const refunds = app.table(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentOrderId: uuid("payment_order_id")
      .notNull()
      .references(() => paymentOrders.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    amountPaise: integer("amount_paise").notNull(),
    reasonCode: text("reason_code").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: refundStatus("status").default("requested").notNull(),
    providerReference: text("provider_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("refunds_payment_status_idx").on(
      table.paymentOrderId,
      table.status,
    ),
    uniqueIndex("refunds_one_open_per_payment_unique")
      .on(table.paymentOrderId)
      .where(sql`${table.status} in ('requested', 'approved', 'processing')`),
  ],
);

export const replacementRequests = app.table(
  "replacement_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => coachAssignments.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reasonCode: text("reason_code").notNull(),
    privateDetails: text("private_details"),
    desiredCoachUserId: uuid("desired_coach_user_id").references(
      () => users.id,
      { onDelete: "restrict" },
    ),
    cycleNumber: integer("cycle_number"),
    responseDeadlineAt: timestamp("response_deadline_at", {
      withTimezone: true,
    }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    status: replacementStatus("status").default("requested").notNull(),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("replacement_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("replacement_requests_coach_status_deadline_idx").on(
      table.desiredCoachUserId,
      table.status,
      table.responseDeadlineAt,
    ),
    uniqueIndex("replacement_requests_one_open_per_cycle_unique")
      .on(table.assignmentId, table.cycleNumber)
      .where(
        sql`${table.status} in ('requested', 'approved')`,
      ),
    uniqueIndex("replacement_requests_one_pending_per_client_unique")
      .on(table.requestedByUserId)
      .where(sql`${table.status} = 'requested'`),
    check(
      "replacement_requests_cycle_valid",
      sql`${table.cycleNumber} is null or ${table.cycleNumber} between 1 and 12`,
    ),
  ],
);

export const notifications = app.table(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    deduplicationKey: text("deduplication_key"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    metadata: jsonb("metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .default({})
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notifications_deduplication_key_unique").on(
      table.deduplicationKey,
    ),
    index("notifications_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const webhookEvents = app.table(
  "webhook_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    processingErrorCode: text("processing_error_code"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "webhook_events_provider_event_pk",
      columns: [table.provider, table.eventId],
    }),
  ],
);

export const scheduledJobs = app.table(
  "scheduled_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobType: text("job_type").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, string | number | boolean | null>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: scheduledJobStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastErrorCode: text("last_error_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scheduled_jobs_deduplication_key_unique").on(
      table.deduplicationKey,
    ),
    index("scheduled_jobs_status_run_idx").on(table.status, table.runAt),
  ],
);

export const auditLogs = app.table(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    requestId: text("request_id"),
    reason: text("reason"),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("audit_logs_target_created_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);

export const idempotencyKeys = app.table(
  "idempotency_keys",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseCode: text("response_code"),
    responseReference: text("response_reference"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "idempotency_keys_scope_key_pk",
      columns: [table.scope, table.key],
    }),
    index("idempotency_keys_expires_idx").on(table.expiresAt),
  ],
);
