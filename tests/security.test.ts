import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRuntimeDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from "../lib/database/runtime-url";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("database credential isolation", () => {
  it("recognizes direct and pooler runtime-role usernames", () => {
    expect(
      isRuntimeDatabaseUrl(
        "postgresql://app_runtime:secret@db.example.test:5432/postgres",
      ),
    ).toBe(true);
    expect(
      isRuntimeDatabaseUrl(
        "postgresql://app_runtime.projectref:secret@pooler.example.test:6543/postgres",
      ),
    ).toBe(true);
    expect(
      isRuntimeDatabaseUrl(
        "postgresql://postgres:secret@db.example.test:5432/postgres",
      ),
    ).toBe(false);
  });

  it("derives a restricted URL only in development", () => {
    const developmentUrl = resolveRuntimeDatabaseUrl({
      appEnvironment: "development",
      databaseUrl:
        "postgresql://postgres:owner@db.example.test:5432/postgres",
      migrationUrl:
        "postgresql://postgres:owner@db.example.test:5432/postgres",
      runtimePassword: "runtime-secret-value",
    });
    expect(new URL(developmentUrl).username).toBe("app_runtime");
    expect(() =>
      resolveRuntimeDatabaseUrl({
        appEnvironment: "production",
        databaseUrl:
          "postgresql://postgres:owner@db.example.test:5432/postgres",
        migrationUrl:
          "postgresql://postgres:owner@db.example.test:5432/postgres",
        runtimePassword: "runtime-secret-value",
      }),
    ).toThrow(/restricted app_runtime/);
  });
});

describe("authorization architecture", () => {
  it("protects linked coach and client matching overviews", () => {
    const clientDirectory = source("components/portal/ClientPortal.tsx");
    const coachOpportunities = source("components/portal/CoachPortal.tsx");
    const coachOverview = source("app/(portal)/client/coaches/[coachId]/page.tsx");
    const clientOverview = source("app/(portal)/coach/opportunities/[assignmentId]/page.tsx");
    expect(clientDirectory).toContain("availableDay");
    expect(clientDirectory).toContain("availableTimeSlot");
    expect(clientDirectory).toContain('name="mode"');
    expect(clientDirectory).toContain('name="state"');
    expect(clientDirectory).toContain('name="city"');
    expect(clientDirectory).toContain('name="district"');
    expect(clientDirectory).toContain('"Mode", "State", "City", "District"');
    expect(clientDirectory).toContain("availabilityTags");
    expect(clientDirectory).toContain("/client/coaches/${coach.userId}");
    expect(coachOpportunities).toContain("/coach/opportunities/${row.assignmentId}");
    expect(coachOpportunities).toContain("/coach/opportunities/${row.id}");
    expect(coachOverview).toContain('requirePageRole("client")');
    expect(coachOverview).toContain("isCoachProfileActive(coach)");
    expect(coachOverview).toContain("coachAssignments.status, \"assigned\"");
    expect(clientOverview).toContain('requirePageRole("coach")');
    expect(clientOverview).toContain("coachSelectionRequests");
    expect(clientOverview).toContain('assignment.status === "open_pool"');
    expect(clientOverview).not.toContain("assessmentReports");
    expect(clientOverview).not.toContain("contactPhone");
  });

  it("highlights assigned coaches and keeps session creation on the coach schedule page", () => {
    const clientDirectory = source("components/portal/ClientPortal.tsx");
    const assessmentForm = source("components/portal/PortalActions.tsx");
    const clientDetail = source("app/(portal)/coach/clients/[clientId]/page.tsx");
    const coachPortal = source("components/portal/CoachPortal.tsx");
    expect(clientDirectory).toContain("assignedCoachRow");
    expect(clientDirectory).toContain("Assigned coach");
    expect(assessmentForm).not.toContain("Required before plan purchase");
    expect(assessmentForm).not.toContain("before purchasing a plan");
    expect(clientDetail).not.toContain("SessionCreateForm");
    expect(coachPortal).toContain("SessionCreateForm");
  });

  it("returns specific field validation details and renders prominent form guidance", () => {
    const errors = source("lib/http/errors.ts");
    const authForms = source("components/auth/AuthForms.tsx");
    expect(errors).toContain("fields,");
    expect(errors).toContain("Please correct the following fields");
    expect(authForms).toContain("Open the verification email from 360 Performance");
    expect(authForms).toContain("Enter exactly 10 digits");
    expect(authForms).toContain("fieldErrors.mobile");
    expect(authForms).toContain("minLength={6}");
    expect(authForms).toContain("passwordVisibility");
    expect(authForms).toContain("EyeOff");
    expect(source("app/api/auth/register/route.ts")).toContain(
      'min(6, "Password must contain at least 6 characters.")',
    );
  });

  it("does not expose or enforce legacy coach copy and capacity fields", () => {
    const profileForm = source("components/portal/PortalActions.tsx");
    const profileApi = source("app/api/coach/profile/route.ts");
    const assignmentRoutes = [
      "app/api/assignments/[assignmentId]/claim/route.ts",
      "app/api/assignments/requests/[requestId]/respond/route.ts",
      "app/api/replacements/[replacementId]/respond/route.ts",
      "app/api/replacements/route.ts",
    ].map(source).join("\n");
    expect(profileForm).not.toContain('name="headline"');
    expect(profileForm).not.toContain('name="biography"');
    expect(profileForm).not.toContain('name="capacity"');
    expect(profileApi).not.toContain("input.capacity");
    expect(assignmentRoutes).not.toContain("coach_at_capacity");
    expect(assignmentRoutes).not.toContain(".capacity");
  });

  it("uses one Supabase signup path for every public client and coach", () => {
    const registration = source("app/api/auth/register/route.ts");
    const registrationForm = source("components/auth/AuthForms.tsx");
    expect(registration).toContain("supabase.auth.signUp");
    expect(registration).toContain("requested_role: input.role");
    expect(registration).toContain("role: input.role");
    expect(registration).toContain("transaction.insert(clientProfiles)");
    expect(registration).toContain("transaction.insert(coachProfiles)");
    expect(registration).toContain("mobile: indianMobileSchema");
    expect(registration).toContain("contactPhone: input.mobile");
    expect(registration).toContain("locationState: input.state");
    expect(registration).toContain("locationCity: input.city");
    expect(registration).toContain("locationDistrict: input.district");
    expect(registration).not.toContain("useDevelopmentBypass");
    expect(registration).not.toContain("admin.auth.admin.createUser");
    expect(registration).not.toContain("isDevelopmentAdmin");
    expect(registration).not.toContain("endsWith");
    expect(
      registrationForm.match(/\.\.\.\(role === "client"/g),
    ).toHaveLength(2);
  });

  it("stores registration mobile numbers and shows them in both overviews", () => {
    const completion = source("app/api/auth/complete-profile/route.ts");
    const session = source("lib/auth/session.ts");
    const clientPortal = source("components/portal/ClientPortal.tsx");
    const coachPortal = source("components/portal/CoachPortal.tsx");
    expect(completion).toContain("mobile: indianMobileSchema");
    expect(completion).toContain("contactPhone:");
    expect(session).toContain("contactPhone: users.contactPhone");
    expect(session).toContain("first.contactPhone ?? authUser.phone");
    expect(clientPortal).toContain("Mobile number");
    expect(clientPortal).toContain('user.phone ?? "Not provided"');
    expect(coachPortal).toContain("Mobile number");
    expect(coachPortal).toContain('user.phone ?? "Not provided"');
  });

  it("does not special-case email addresses in recovery or consultations", () => {
    const recovery = source("app/api/auth/forgot-password/route.ts");
    const consultations = source("app/api/consultations/route.ts");
    expect(recovery).toContain("resetPasswordForEmail");
    expect(recovery).not.toContain("endsWith");
    expect(consultations).not.toContain("APP_ENV");
    expect(consultations).not.toContain("fake_email_required");
  });

  it("routes password recovery through a dedicated verified session callback", () => {
    const request = source("app/api/auth/forgot-password/route.ts");
    const recovery = source("app/auth/recovery/route.ts");
    const login = source("app/login/page.tsx");
    expect(request).toContain('new URL("/auth/recovery", applicationOrigin)');
    expect(request).not.toContain("${applicationOrigin}/auth/callback");
    expect(recovery).toContain("verifyOtp");
    expect(recovery).toContain('type: "recovery"');
    expect(recovery).toContain("exchangeCodeForSession");
    expect(recovery).toContain('new URL("/update-password", url.origin)');
    expect(login).toContain("recovery-link-invalid");
  });

  it("reconciles Razorpay before releasing an abandoned checkout", () => {
    const route = source("app/api/payments/razorpay/abandon/route.ts");
    const abandonment = source("lib/payments/abandonment.ts");
    expect(route).toContain("reconcileRazorpayCheckout");
    expect(abandonment).toContain("orders.fetch(input.orderId)");
    expect(abandonment).toContain("orders.fetchPayments(input.orderId)");
    expect(abandonment).toContain('payment.status');
    expect(abandonment).toContain('["authorized", "captured"]');
    expect(abandonment).toContain('failureCode: "checkout_abandoned"');
    expect(abandonment).toContain('status: "cancelled"');
    expect(abandonment).toContain("FOR UPDATE");
    expect(abandonment).toContain('eq(paymentOrders.userId, input.userId)');
  });

  it("releases interrupted plan and coach checkouts through reconciliation", () => {
    const checkout = source("components/portal/razorpay-checkout.ts");
    const client = source("components/portal/CheckoutPanel.tsx");
    const coach = source("components/portal/ActivationActions.tsx");
    expect(checkout).toContain('"/api/payments/razorpay/abandon"');
    expect(checkout).toContain('"dismissed"');
    expect(checkout).toContain('"payment_failed"');
    expect(client).toContain("abandonRazorpayCheckout");
    expect(coach).toContain("abandonRazorpayCheckout");
    expect(client).toContain("No payment was taken");
    expect(coach).toContain("No payment was taken");
    expect(client).toContain("messagePlanCode === plan.code");
  });

  it("reconciles an existing checkout before creating another order", () => {
    const orders = source("app/api/payments/razorpay/orders/route.ts");
    expect(orders).toContain("reconcileExistingCheckout");
    expect(orders).toContain(
      "await reconcileExistingCheckout(user, input.purpose, requestId)",
    );
    expect(orders).toContain("reconcileRazorpayCheckout");
    expect(orders).toContain('eq(planPurchases.status, "pending")');
    expect(orders).toContain('"payment_still_processing"');
  });

  it("keeps coach certification and public discovery behind explicit activation gates", () => {
    const approval = source(
      "app/api/admin/coaches/[userId]/approve/route.ts",
    );
    const directory = source("app/api/coaches/route.ts");
    expect(approval).toContain('eq(coachProfiles.approvalStatus, "submitted")');
    expect(directory).toContain("activeCoachConditions()");
    expect(directory).toContain('eq(coachProfiles.acceptingClients, true)');
    expect(directory).toContain('eq(users.status, "active")');
    expect(approval).toContain("coachCertifications");
    expect(approval).toContain("certificationCount.value < 1");
    expect(approval).toContain('verificationStatus: "approved"');
  });

  it("requires coach certification ownership and admin-only review", () => {
    const upload = source("app/api/coach/certifications/route.ts");
    const submit = source("app/api/coach/certifications/submit/route.ts");
    const reject = source("app/api/admin/coaches/[userId]/reject/route.ts");
    expect(upload).toContain('requireRole("coach")');
    expect(upload).toContain("1024 * 1024");
    expect(submit).toContain('requireRole("coach")');
    expect(submit).toContain("certificationCount.value < 1");
    expect(reject).toContain('requireRole("admin")');
    expect(reject).toContain("rejectionReason: input.reason");
    expect(reject).toContain('verificationStatus: "rejected"');
  });

  it("keeps Other-only coaches out of every Athlete / Executive assignment path", () => {
    const upload = source("app/api/coach/certifications/route.ts");
    const approval = source(
      "app/api/admin/coaches/[userId]/approve/route.ts",
    );
    expect(upload).toContain('qualificationType === "other"');
    expect(upload).toContain("qualificationTitle");
    expect(approval).toContain("athleteExecutiveEligible");
    expect(approval).toContain("qualification_type <> 'other'");

    for (const path of [
      "app/api/assignments/[assignmentId]/select-coach/route.ts",
      "app/api/assignments/requests/[requestId]/respond/route.ts",
      "app/api/assignments/[assignmentId]/claim/route.ts",
      "app/api/replacements/route.ts",
      "app/api/replacements/[replacementId]/respond/route.ts",
    ]) {
      expect(source(path)).toContain("coachCanServePlan");
      expect(source(path)).toContain("coach_plan_ineligible");
    }

    expect(source("app/api/assignments/open-pool/route.ts")).toContain(
      "coachCanServePlan",
    );
    expect(source("components/portal/ClientPortal.tsx")).toContain(
      "coachCanServePlan",
    );
    expect(source("components/portal/CoachPortal.tsx")).toContain(
      "coachCanServePlan",
    );
    expect(source("lib/assignments/lifecycle.ts")).toContain(
      "coachCanServePlan",
    );
  });

  it("keeps activation availability and testing fee writes coach-owned and server validated", () => {
    const availability = source("app/api/coach/activation/route.ts");
    const payment = source("app/api/coach/activation/pay/route.ts");
    const activation = source("lib/coaches/activation.ts");
    expect(availability).toContain('requireRole("coach")');
    expect(availability).toContain("coachAvailabilitySchema.parse");
    expect(payment).toContain('requireRole("coach")');
    expect(payment).toContain('process.env.APP_ENV === "production"');
    expect(payment).toContain('process.env.PAYMENTS_MODE !== "mock"');
    expect(payment).toContain("payment_provider_unavailable");
    expect(payment).toContain("coachActivationOptionFor");
    expect(payment).toContain("coachActivationDurationSchema");
    expect(payment).toContain('provider: "testing"');
    expect(activation).toContain("15_900");
    expect(activation).toContain("isNotNull(coachProfiles.approvedAt)");
    expect(activation).toContain("gt(coachProfiles.activationExpiresAt, now)");
  });

  it("keeps Razorpay credentials server-only and records one immutable payment purpose", () => {
    const environment = source("lib/env/server.ts");
    const browserEnvironment = source("lib/env/browser.ts");
    const provider = source("lib/payments/razorpay.ts");
    const migration = source("drizzle/0023_odd_magik.sql");
    const obsoleteConstraintFix = source(
      "drizzle/0026_remove_obsolete_payment_subject_constraint.sql",
    );
    const activationOptionsMigration = source(
      "drizzle/0030_cloudy_star_brand.sql",
    );
    expect(environment).toContain("RAZORPAY_KEY_ID");
    expect(environment).toContain("RAZORPAY_KEY_SECRET");
    expect(environment).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(environment).toContain(
      "RAZORPAY_WEBHOOK_SECRET is required when provider payments are enabled.",
    );
    expect(environment).toContain("Test Razorpay credentials are forbidden in production");
    expect(browserEnvironment).not.toContain("RAZORPAY_KEY_SECRET");
    expect(provider).toContain('import "server-only"');
    expect(migration).toContain('"purpose"');
    expect(migration).toContain("payment_orders_subject_valid");
    expect(migration).toContain('"provider_payment_id"');
    expect(migration).toContain('"provider_signature"');
    expect(migration).toContain("payment_orders_provider_payment_unique");
    expect(migration).toContain("coach_activation_payments_order_unique");
    expect(migration).toContain('"attempts" integer DEFAULT 0 NOT NULL');
    expect(obsoleteConstraintFix).toContain(
      'DROP CONSTRAINT IF EXISTS "payment_orders_one_subject"',
    );
    expect(activationOptionsMigration).toContain(
      '"activation_duration_days"',
    );
    expect(activationOptionsMigration).toContain("in (30, 90, 365)");
  });

  it("fulfills Razorpay payments only after server verification", () => {
    const orderRoute = source("app/api/payments/razorpay/orders/route.ts");
    const verifyRoute = source("app/api/payments/razorpay/verify/route.ts");
    const webhookRoute = source("app/api/webhooks/payments/route.ts");
    const fulfillment = source("lib/payments/fulfillment.ts");

    expect(orderRoute).toContain("getRazorpayClient().orders.create");
    expect(orderRoute).toContain("plan.pricePaise");
    expect(orderRoute).toContain("coachActivationOptionFor");
    expect(orderRoute).toContain("activationDurationDays");
    expect(orderRoute).toContain(
      'inArray(paymentOrders.status, ["created", "authorized"])',
    );
    expect(verifyRoute).toContain("verifyRazorpayCheckoutSignature");
    expect(verifyRoute).toContain("razorpay.payments.fetch");
    expect(webhookRoute).toContain("verifyRazorpayWebhookSignature");
    expect(webhookRoute).toContain(
      'request.headers.get("x-razorpay-event-id")',
    );
    expect(fulfillment).toContain('status: "captured"');
    expect(fulfillment).toContain("payment_amount_mismatch");
  });

  it("validates profile photos server-side", () => {
    const photo = source("app/api/profile/photo/route.ts");
    expect(photo).toContain("500 * 1024");
    expect(photo).toContain('"image/jpeg"');
    expect(photo).toContain('"image/png"');
    expect(photo).toContain('user.roles.includes("client")');
    expect(photo).toContain('user.roles.includes("coach")');
  });

  it("enforces MFA inside the reusable admin role guard", () => {
    const session = source("lib/auth/session.ts");
    expect(session).toContain('role === "admin"');
    expect(session).toContain('user.aal !== "aal2"');
  });

  it("separates each portal and profile API by server-side role checks", () => {
    expect(source("app/(portal)/client/layout.tsx")).toContain(
      'requirePageRole("client")',
    );
    expect(source("app/(portal)/coach/layout.tsx")).toContain(
      'requirePageRole("coach")',
    );
    expect(source("app/(portal)/admin/layout.tsx")).toContain(
      'requirePageRole("admin")',
    );
    expect(source("app/api/coach/profile/route.ts")).toContain(
      'requireRole("coach")',
    );
    expect(
      source("app/(portal)/admin/clients/[userId]/page.tsx"),
    ).toContain('requirePageRole("admin")');
    expect(
      source("app/(portal)/admin/coaches/[userId]/page.tsx"),
    ).toContain('requirePageRole("admin")');
  });

  it("requires admin authorization on privileged endpoints", () => {
    for (const path of [
      "app/api/admin/coaches/[userId]/approve/route.ts",
      "app/api/admin/coaches/[userId]/activate/route.ts",
      "app/api/admin/coaches/[userId]/ban/route.ts",
      "app/api/admin/clients/[userId]/status/route.ts",
      "app/api/admin/refunds/[refundId]/approve/route.ts",
      "app/api/admin/jobs/run/route.ts",
    ]) {
      expect(source(path)).toContain('requireRole("admin")');
    }
  });

  it("supports filtered admin account operations and manual activation rules", () => {
    const clientStatus = source(
      "app/api/admin/clients/[userId]/status/route.ts",
    );
    const coachBan = source("app/api/admin/coaches/[userId]/ban/route.ts");
    const coachActivation = source(
      "app/api/admin/coaches/[userId]/activate/route.ts",
    );
    const waiverBackfill = source(
      "drizzle/0025_backfill_admin_certification_waivers.sql",
    );
    const adminPortal = source("components/portal/AdminPortal.tsx");
    expect(clientStatus).toContain('requireRole("admin")');
    expect(clientStatus).toContain("hasClientAvailability");
    expect(clientStatus).toContain("client_availability_required");
    expect(clientStatus).not.toContain("paymentOrders");
    expect(clientStatus).not.toContain("planPurchases");
    expect(coachBan).toContain('requireRole("admin")');
    expect(coachBan).toContain('status: "suspended"');
    expect(coachBan).toContain("acceptingClients: false");
    expect(coachBan).toContain("coachAssignments");
    expect(coachBan).toContain('eq(coachAssignments.status, "assigned")');
    expect(coachBan).toContain("coach_has_assigned_clients");
    expect(coachActivation).toContain('requireRole("admin")');
    expect(coachActivation).toContain("hasCoachAvailability");
    expect(coachActivation).toContain("coach_availability_required");
    expect(coachActivation).toContain("addActivationPeriod");
    expect(coachActivation).toContain("certificationWaivedAt");
    expect(coachActivation).toContain("certificationWaivedByUserId");
    expect(coachActivation).toContain("certificationWaived: true");
    expect(coachActivation).toContain('action: "admin.coach_activated"');
    expect(coachActivation).not.toContain("coachActivationPayments");
    expect(waiverBackfill).toContain("admin.coach_activated");
    expect(waiverBackfill).toContain("certification_waived_at");
    expect(adminPortal).toContain('name="coachStatus"');
    expect(adminPortal).toContain('name="clientPayment"');
    expect(adminPortal).toContain('["paid", "active"]');
    expect(adminPortal).toContain("Ban coach");
    expect(adminPortal).toContain("Activate 30 days");
    expect(adminPortal).toContain("assignedClientCount");
    expect(adminPortal).toContain("Cannot ban while clients are assigned");
    expect(adminPortal).toContain("Deactivate");
    expect(adminPortal).toContain("/admin/clients/${row.id}");
    expect(adminPortal).toContain("/admin/coaches/${row.userId}");
  });

  it("keeps audit records backend-only and removes admin analytics navigation", () => {
    const adminPortal = source("components/portal/AdminPortal.tsx");
    const portalShell = source("components/portal/PortalShell.tsx");
    const adminSection = source("app/(portal)/admin/[section]/page.tsx");
    expect(adminPortal).not.toContain("Audit activity");
    expect(adminPortal).not.toContain("auditLogs");
    expect(portalShell).not.toContain('href: "/admin/analytics"');
    expect(adminSection).not.toContain('"analytics",');
    expect(adminSection).toContain(
      'if (section === "analytics") redirect("/admin")',
    );
  });

  it("allows session updates but exposes no session cancellation action", () => {
    const sessionManager = source("components/portal/SessionManager.tsx");
    const sessionUpdate = source("app/api/sessions/[sessionId]/route.ts");
    expect(sessionManager).toContain("Manage session");
    expect(sessionManager).toContain("Reschedule");
    expect(sessionManager).toContain("Replace Google Meet link");
    expect(sessionManager).toContain("Mark missed");
    expect(sessionManager).toContain("Mark complete");
    expect(sessionManager).not.toContain("Cancel session");
    expect(sessionManager).not.toContain("Need to cancel?");
    expect(sessionManager).not.toContain('status: "cancelled"');
    expect(sessionUpdate).toContain(
      'status: z.enum(["completed", "missed"]).optional()',
    );
    expect(sessionUpdate).toContain('action: z.enum(["reschedule", "meeting_link", "status"])');
    expect(sessionUpdate).not.toContain('input.status === "cancelled"');
  });

  it("does not let a normal sign-in undo an admin suspension", () => {
    for (const path of [
      "app/api/auth/login/route.ts",
      "app/auth/callback/route.ts",
    ]) {
      const authentication = source(path);
      expect(authentication).toContain('eq(users.status, "pending_verification")');
    }
  });

  it("supports username sign-in without exposing account lookup details", () => {
    const login = source("app/api/auth/login/route.ts");
    const form = source("components/auth/AuthForms.tsx");
    expect(form).toContain("Email address or username");
    expect(form).toContain('name="identifier"');
    expect(login).toContain("users.normalizedUsername");
    expect(login).toContain("auth.admin.getUserById(account.authUserId)");
    expect(login).toContain("email,\n      password: input.password");
    expect(login).toContain(
      "The email address, username, or password is incorrect.",
    );
    expect(login.match(/throw invalidCredentials\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(login).not.toContain("That username does not exist");
  });

  it("uses neutral, event-based wording for recipient notifications", () => {
    const registration = [
      source("app/api/auth/register/route.ts"),
      source("app/api/auth/complete-profile/route.ts"),
    ].join("\n");
    const activation = [
      source("app/api/admin/clients/[userId]/status/route.ts"),
      source("app/api/admin/coaches/[userId]/activate/route.ts"),
      source("app/api/admin/coaches/[userId]/approve/route.ts"),
      source("app/api/coach/activation/pay/route.ts"),
      source("lib/payments/fulfillment.ts"),
      source("lib/notifications/due.ts"),
    ].join("\n");
    const matching = [
      source("lib/assignments/lifecycle.ts"),
      source("app/api/assignments/[assignmentId]/select-coach/route.ts"),
      source("app/api/assignments/[assignmentId]/claim/route.ts"),
      source("app/api/assignments/requests/[requestId]/respond/route.ts"),
      source("app/api/replacements/[replacementId]/respond/route.ts"),
      source("lib/service-cycles/lifecycle.ts"),
    ].join("\n");
    const assessment = source("app/api/assessments/route.ts");

    expect(registration).toContain("Your account has been created");
    expect(registration).not.toContain("Your client account is ready");
    expect(activation).toContain("Your profile is active");
    expect(activation).not.toContain("Your coach profile is active");
    expect(activation).not.toContain("activated your client account");
    expect(matching).toContain("Open Coach Pool started");
    expect(matching).toContain("New coaching assignment");
    expect(matching).toContain("Coach switch completed");
    expect(matching).not.toContain("Client cycle completed");
    expect(assessment).toContain("Health assessment saved");
    expect(assessment).not.toContain("You can now purchase a coaching plan");
  });

  it("uses the full 360 Performance brand in public and portal lockups", () => {
    const publicShell = source("components/public/PublicShell.tsx");
    const portalShell = source("components/portal/PortalShell.tsx");
    const checkout = source("components/portal/razorpay-checkout.ts");
    expect(publicShell).toContain("className={styles.brandNumber}>360</span> Performance");
    expect(portalShell).toContain("className={styles.brandNumber}>360</span> Performance");
    expect(portalShell).toContain("<small>Human potential, engineered</small>");
    expect(portalShell).not.toContain("<small>{identity.roleLabel}</small>");
    expect(checkout).toContain('name: "360 Performance"');
    expect(publicShell).not.toContain("<strong>Performance</strong>");
    expect(portalShell).not.toContain("<strong>Performance</strong>");
  });

  it("shows the approved footer contacts and social destinations", () => {
    const publicShell = source("components/public/PublicShell.tsx");
    const portalShell = source("components/portal/PortalShell.tsx");
    const privacy = source("app/privacy/page.tsx");
    expect(publicShell).toContain('<BrandMark tagline="Elite coaching platform" />');
    expect(publicShell).toContain("+91 9761289717");
    expect(publicShell).not.toContain("Evidence-led. Human-first.");
    expect(publicShell).toContain("support@360performance.in");
    expect(publicShell).toContain("Rampur Road, Haldwani – 263139");
    expect(publicShell).toContain("https://www.facebook.com/share/14qE9hADXuV/");
    expect(publicShell).toContain("https://www.instagram.com/360performance.in?igsh=Z3duazY0MjgwMnpj");
    expect(publicShell).toContain("https://youtube.com/@team360performance?si=EFgQecDQ0AQha2yi");
    expect(publicShell).toContain('<SocialIcon brand="facebook" />');
    expect(publicShell).toContain('<SocialIcon brand="instagram" />');
    expect(publicShell).toContain('<SocialIcon brand="youtube" />');
    expect(portalShell).toContain("support@360performance.in");
    expect(privacy).toContain("support@360performance.in");
    expect(privacy).toContain("Haldwani, Uttarakhand 263139");
    expect(publicShell).not.toContain("Support@360perfomance.in");
    expect(portalShell).not.toContain("Support@360perfomance.in");
  });

  it("removes plan entry points from the landing page without deleting plan functionality", () => {
    const publicShell = source("components/public/PublicShell.tsx");
    const landingPage = source("app/page.tsx");
    const publicPlansPage = source("app/plans/page.tsx");
    const publicCoachProfile = source("app/coaches/[slug]/page.tsx");
    const clientPortal = source("components/portal/ClientPortal.tsx");
    const checkout = source("components/portal/CheckoutPanel.tsx");
    expect(publicShell).not.toContain('{ href: "/plans", label: "Plans" }');
    expect(publicShell).not.toContain('href="/plans"');
    expect(landingPage).not.toContain('href="/plans"');
    expect(landingPage).not.toContain('href="/plans#athlete-executive"');
    expect(publicCoachProfile).toContain('href="/plans"');
    expect(publicPlansPage).toContain("publicPlans.map");
    expect(publicPlansPage).not.toContain('redirect("/register")');
    expect(landingPage).toContain('href="/register"');
    expect(clientPortal).toContain('section === "plan"');
    expect(checkout).toContain('fetch("/api/plans")');
  });

  it("requires authenticated scheduled jobs and a production cron secret", () => {
    const jobs = source("app/api/admin/jobs/run/route.ts");
    const environment = source("lib/env/server.ts");
    expect(jobs).toContain("`Bearer ${secret}`");
    expect(jobs).toContain("cron_unauthorized");
    expect(environment).toContain('environment.APP_ENV === "production"');
    expect(environment).toContain("!environment.CRON_SECRET");
    expect(environment).toContain("CRON_SECRET is required in production");
  });

  it("requires idempotency for payment, assignment, and refund writes", () => {
    for (const path of [
      "app/api/payments/mock/route.ts",
      "app/api/assignments/[assignmentId]/select-coach/route.ts",
      "app/api/assignments/requests/[requestId]/respond/route.ts",
      "app/api/refunds/route.ts",
      "app/api/admin/refunds/[refundId]/approve/route.ts",
      "app/api/admin/coaches/[userId]/ban/route.ts",
      "app/api/admin/coaches/[userId]/activate/route.ts",
      "app/api/admin/clients/[userId]/status/route.ts",
      "app/api/replacements/route.ts",
      "app/api/replacements/[replacementId]/respond/route.ts",
      "app/api/assignments/[assignmentId]/claim/route.ts",
      "app/api/coach/certifications/submit/route.ts",
      "app/api/admin/coaches/[userId]/reject/route.ts",
      "app/api/coach/activation/pay/route.ts",
      "app/api/consultations/route.ts",
    ]) {
      expect(source(path)).toContain("requireIdempotencyKey");
      expect(source(path)).toContain("runIdempotent");
    }
  });

  it("removes the temporary free plan and zero-price purchase bypass", () => {
    const checkout = source("components/portal/CheckoutPanel.tsx");
    const payment = source("app/api/payments/mock/route.ts");
    const migration = source("drizzle/0029_remove_temporary_free_plan.sql");
    expect(checkout).not.toContain("Activate free test plan");
    expect(checkout).not.toContain("freeTestPlan");
    expect(payment).not.toContain("TEMPORARY_FREE_PLAN");
    expect(payment).toContain("plan.pricePaise <= 0");
    expect(migration).toContain("'temporary-free-flow-90'");
    expect(migration).toContain('SET "active" = false');
  });

  it("records free consultations with a validated mobile number and admin notification", () => {
    const consultation = source("app/api/consultations/route.ts");
    expect(consultation).toContain("contactPhone: indianMobileSchema");
    expect(consultation).not.toContain(".insert(paymentOrders)");
    expect(consultation).toContain('type: "admin.consultation_requested"');
  });

  it("routes client-submitted refund requests with contact details to the admin queue", () => {
    const request = source("app/api/refunds/route.ts");
    const adminPortal = source("components/portal/AdminPortal.tsx");
    const adminRoute = source("app/(portal)/admin/[section]/page.tsx");
    expect(request).toContain("contactEmail: z.email()");
    expect(request).toContain("contactPhone: indianMobileSchema");
    expect(request).toContain('actionUrl: "/admin/refunds"');
    expect(adminRoute).toContain('"refunds"');
    expect(adminPortal).toContain('section === "refunds"');
    expect(adminPortal).toContain("clientName: users.displayName");
    expect(adminPortal).toContain("planName: plans.name");
    expect(adminPortal).toContain("contactPhone: refunds.contactPhone");
    expect(adminPortal).toContain("contactEmail: refunds.contactEmail");
  });

  it("keeps plan purchase and refund actions inside My Plan", () => {
    const shell = source("components/portal/PortalShell.tsx");
    const clientPortal = source("components/portal/ClientPortal.tsx");
    const clientRoute = source("app/(portal)/client/[section]/page.tsx");
    const refundRequest = source("app/api/refunds/route.ts");
    const refundApproval = source(
      "app/api/admin/refunds/[refundId]/approve/route.ts",
    );
    const catalogueMigration = source(
      "drizzle/0021_sync_public_plan_catalog.sql",
    );

    expect(shell).not.toContain('href: "/client/payments"');
    expect(clientPortal).not.toContain('section === "payments"');
    expect(clientPortal).toContain('id="available-plans"');
    expect(clientPortal).toContain("<CheckoutPanel");
    expect(clientRoute).toContain('redirect("/client/plan")');
    expect(refundRequest).toContain('actionUrl: "/client/plan"');
    expect(refundApproval).toContain('actionUrl: "/client/plan"');
    expect(catalogueMigration).toContain("CROSS JOIN duration_catalog");
    expect(catalogueMigration).toContain('VALUES (90, 3), (180, 6), (365, 12)');
    expect(catalogueMigration).toContain("ON CONFLICT");
  });

  it("keeps health assessment optional for purchase while retaining its reminder", () => {
    const checkout = source("app/api/payments/mock/route.ts");
    const checkoutPanel = source("components/portal/CheckoutPanel.tsx");
    const clientLayout = source("app/(portal)/client/layout.tsx");
    expect(checkout).not.toContain("getCompletedPreCoachingAssessment");
    expect(checkout).not.toContain("health_assessment_required");
    expect(checkoutPanel).not.toContain("assessmentComplete");
    expect(clientLayout).toContain('"/client/assessment": "warning"');
  });

  it("keeps progress out of the V1 client portal surface", () => {
    expect(source("components/portal/PortalShell.tsx")).not.toContain(
      'href: "/client/progress"',
    );
    expect(source("app/(portal)/client/[section]/page.tsx")).not.toContain(
      '"progress"',
    );
    expect(source("components/portal/ClientPortal.tsx")).not.toContain(
      'section === "progress"',
    );
    expect(existsSync(join(process.cwd(), "app/api/progress/route.ts"))).toBe(false);
  });

  it("enforces the timed assignment lifecycle and refund gate on the server", () => {
    const selection = source(
      "app/api/assignments/[assignmentId]/select-coach/route.ts",
    );
    const claim = source(
      "app/api/assignments/[assignmentId]/claim/route.ts",
    );
    const refund = source("app/api/refunds/route.ts");
    const jobs = source("app/api/admin/jobs/run/route.ts");
    expect(selection).toContain("reconcileAssignmentLifecycle(id)");
    expect(selection).toContain('eq(coachAssignments.status, "selection")');
    expect(selection).toContain("pendingCount.value >= 3");
    expect(selection).toContain("coachSelectionRequests");
    expect(claim).toContain("reconcileAssignmentLifecycle(id)");
    expect(claim).toContain("applicationWindowEndsAt <= new Date()");
    expect(claim).toContain("FOR UPDATE");
    expect(refund).toContain("coachAssignments.refundEligibleAt");
    expect(refund).toContain('eq(coachAssignments.status, "selection")');
    expect(refund).toContain('status: "cancelled"');
    expect(jobs).toContain('"expire_coach_application"');
    expect(jobs).toContain("CRON_SECRET");
    const response = source(
      "app/api/assignments/requests/[requestId]/respond/route.ts",
    );
    expect(response).toContain('z.enum(["accept", "reject"])');
    expect(response).toContain("activateAssignedPurchase");
    expect(response).toContain('status: "cancelled"');
  });

  it("keeps coach switching at 30-day boundaries and coach-owned responses", () => {
    const request = source("app/api/replacements/route.ts");
    const response = source(
      "app/api/replacements/[replacementId]/respond/route.ts",
    );
    const lifecycle = source("lib/service-cycles/lifecycle.ts");
    expect(request).toContain("desiredCoachUserId");
    expect(request).toContain("SWITCH_RESPONSE_WINDOW_MS");
    expect(request).not.toContain('status: "replacement_pending"');
    expect(response).toContain('requireRole("coach")');
    expect(response).toContain('z.enum(["accept", "reject"])');
    expect(response).toContain("responseDeadlineAt <= new Date()");
    expect(lifecycle).toContain('status: "completed"');
    expect(lifecycle).not.toContain("coachPayoutForCycle");
    expect(lifecycle).not.toContain("coachCyclePayouts");
    expect(lifecycle).not.toContain("earnings.cycle_available");
    expect(lifecycle).toContain("acceptedSwitch?.desiredCoachUserId");
  });

  it("validates structured assessment answers and medical context server-side", () => {
    const assessment = source("app/api/assessments/route.ts");
    expect(assessment).toContain("preCoachingResponsesSchema.parse");
    expect(assessment).toContain("assessmentReports.assessmentId");
    expect(assessment).toContain('"medical_context_required"');
  });

  it("keeps chat out of the V1 application surface", () => {
    expect(existsSync(join(process.cwd(), "app/api/conversations/route.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/api/messages/route.ts"))).toBe(false);
    expect(source("app/api/files/upload/route.ts")).not.toContain("chat-attachment");
    expect(source("app/api/files/signed-url/route.ts")).not.toContain("chat-attachment");
    expect(source("app/api/assignments/[assignmentId]/claim/route.ts")).not.toContain(
      "insert(conversations)",
    );
    expect(
      source("app/api/assignments/[assignmentId]/select-coach/route.ts"),
    ).not.toContain("insert(conversations)");
  });

  it("keeps the Google OAuth sign-in and required profile-completion path", () => {
    const forms = source("components/auth/AuthForms.tsx");
    const callback = source("app/auth/callback/route.ts");
    const completion = source("app/api/auth/complete-profile/route.ts");
    expect(forms).toContain("signInWithOAuth");
    expect(forms).toContain('provider: "google"');
    expect(callback).toContain("exchangeCodeForSession");
    expect(callback).toContain('new URL("/onboarding"');
    expect(completion).toContain("indianMobileSchema");
  });

  it("does not expose admin plan-management endpoints", () => {
    expect(existsSync(join(process.cwd(), "app/api/admin/plans/route.ts"))).toBe(false);
    expect(
      existsSync(join(process.cwd(), "app/api/admin/plans/[planId]/route.ts")),
    ).toBe(false);
    expect(source("components/portal/PortalShell.tsx")).not.toContain(
      'href: "/admin/plans"',
    );
  });

  it("keeps Storage private and forces RLS in migrations", () => {
    const migration = source("drizzle/0001_amazing_doctor_faustus.sql");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("'assessment-reports'");
    expect(migration).toContain("'chat-attachments'");
    expect(migration).toMatch(/public,\s*file_size_limit/);
    expect(migration).toMatch(/false,\s*10485760/);

    const profileMigration = source("drizzle/0004_brainy_wrecker.sql");
    expect(profileMigration).toContain('"app"."coach_certifications"');
    expect(profileMigration).toContain('"app"."profile_photos"');
    expect(profileMigration).toContain("FORCE ROW LEVEL SECURITY");
    expect(profileMigration).toContain("'profile-photos'");
    expect(profileMigration).toContain("'coach-certificates'");
    expect(profileMigration).toMatch(/false,\s*512000/);
    expect(profileMigration).toMatch(/false,\s*1048576/);

    const activationMigration = source("drizzle/0005_tan_northstar.sql");
    expect(activationMigration).toContain('"app"."coach_activation_payments"');
    expect(activationMigration).toContain("FORCE ROW LEVEL SECURITY");
    expect(activationMigration).toContain("FROM PUBLIC, anon, authenticated");
    expect(activationMigration).toContain("coach_profiles_available_days_valid");
    expect(activationMigration).toContain("coach_activation_payments_period_valid");

    const cycleMigration = source("drizzle/0009_overjoyed_zzzax.sql");
    expect(cycleMigration).toContain('"app"."service_cycles"');
    expect(cycleMigration).toContain('"app"."coach_cycle_payouts"');
    expect(cycleMigration).toContain("FORCE ROW LEVEL SECURITY");
    expect(cycleMigration).toContain("FROM PUBLIC, anon, authenticated");
    expect(cycleMigration).toContain('"duration_days"');
    expect(cycleMigration).not.toContain("setUTCMonth");

    const notificationMigration = source("drizzle/0011_slow_speed.sql");
    expect(notificationMigration).toContain(
      '"app"."coach_selection_requests"',
    );
    expect(notificationMigration).toContain('"app"."notifications"');
    expect(notificationMigration).toContain("FORCE ROW LEVEL SECURITY");
    expect(notificationMigration).toContain(
      "FROM PUBLIC, anon, authenticated",
    );

    const groupMigration = source("drizzle/0022_heavy_kat_farrell.sql");
    expect(groupMigration).toContain('"app"."coaching_groups"');
    expect(groupMigration).toContain('"app"."coaching_group_members"');
    expect(groupMigration).toContain('"app"."coaching_group_sessions"');
    expect(groupMigration).toContain("FORCE ROW LEVEL SECURITY");
    expect(groupMigration).toContain("FROM PUBLIC, anon, authenticated");
    expect(groupMigration).toContain("FOR UPDATE");
    expect(groupMigration).toContain("active_member_count >= 20");
    expect(groupMigration).toContain("Group sessions cannot be cancelled");
  });

  it("keeps group coaching role-scoped and does not expose cancellation", () => {
    const memberRoute = source("app/api/coaching-groups/[groupId]/members/route.ts");
    const createSessionRoute = source("app/api/coaching-groups/[groupId]/sessions/route.ts");
    const updateSessionRoute = source("app/api/group-sessions/[sessionId]/route.ts");
    const joinRoute = source("app/api/group-sessions/[sessionId]/join/route.ts");
    expect(memberRoute).toContain("requireGroupManager");
    expect(memberRoute).toContain('like(plans.code, "group-online-coaching-%")');
    expect(createSessionRoute).toContain("getEligibleGroupMembers");
    expect(createSessionRoute).toContain("notifications");
    expect(updateSessionRoute).not.toContain('"cancelled"');
    expect(joinRoute).toContain("coachingGroupMembers.clientUserId, user.id");
    expect(joinRoute).toContain("planPurchases.status, \"active\"");
  });

  it("keeps notifications authenticated, user-scoped, and server-owned", () => {
    const route = source("app/api/notifications/route.ts");
    expect(route).toContain("requireUser()");
    expect(route).toContain("notifications.userId, user.id");
    expect(route).toContain("assertSameOrigin(request)");
    expect(source("components/portal/PortalShell.tsx")).toContain(
      "<NotificationCenter />",
    );
  });
});
