import { and, asc, desc, eq, gt, inArray, like, ne, or } from "drizzle-orm";
import Link from "next/link";
import {
  CalendarDays,
  CircleCheckBig,
  CreditCard,
  MapPin,
  ShieldCheck,
  Target,
} from "lucide-react";
import { getDb } from "@/db";
import {
  assessments,
  coachAssignments,
  coachProfiles,
  coachSelectionRequests,
  coachingSessions,
  coachingGroupMembers,
  coachingGroups,
  coachingGroupSessions,
  clientProfiles,
  paymentOrders,
  planPurchases,
  planUpgrades,
  plans,
  refunds,
  replacementRequests,
  serviceCycles,
  users,
} from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/session";
import { preCoachingDraftResponsesSchema } from "@/lib/assessments/pre-coaching";
import { getCompletedPreCoachingAssessment } from "@/lib/assessments/status";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";
import {
  activeCoachConditions,
  coachAvailabilityDayLabels,
  coachAvailabilityDays,
  coachAvailabilityTimeSlotLabels,
  coachAvailabilityTimeSlots,
  type CoachAvailabilityDay,
} from "@/lib/coaches/activation";
import { reconcileDueAssignmentLifecycles } from "@/lib/assignments/lifecycle";
import {
  clientPreferredTimeSchema,
  coachMatchesClientAvailability,
} from "@/lib/assignments/client-availability";
import { formatPlanDuration } from "@/lib/plans/duration";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import {
  getOnlineBasicUpgradeOffer,
} from "@/lib/plans/upgrade";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";
import { PageIntro } from "./PortalShell";
import {
  DataTable,
  Panel,
  PanelHeader,
  PrimaryLink,
  StatCard,
  StatusBadge,
} from "./PortalPrimitives";
import {
  ActionButton,
  AssessmentForm,
  CoachSwitchRequestForm,
} from "./PortalActions";
import { ProfilePhotoForm } from "./ProfilePhotoForm";
import { RefundRequestForm } from "./RefundRequestForm";
import { CheckoutPanel } from "./CheckoutPanel";
import { PlanUpgradePanel } from "./PlanUpgradePanel";
import { SessionCard } from "./SessionManager";
import styles from "./portal.module.css";

export async function ClientPortalPage({
  section = "overview",
  filters = {},
}: {
  section?: string;
  filters?: {
    availableDays?: string | string[];
    preferredTime?: string;
    mode?: string;
    state?: string;
    city?: string;
    district?: string;
  };
}) {
  const user = await getCurrentAppUser();
  if (!user) return null;
  const db = getDb();
  await reconcileDueAssignmentLifecycles();
  await reconcileDueServiceCycles();
  const [[clientProfile], purchases, assignments, selectionRequests, serviceCycleRows, sessions, assessmentRows, payments, refundRows, replacementRows, completedAssessment] =
    await Promise.all([
      db
        .select({
          state: clientProfiles.locationState,
          city: clientProfiles.locationCity,
          district: clientProfiles.locationDistrict,
        })
        .from(clientProfiles)
        .where(eq(clientProfiles.userId, user.id))
        .limit(1),
      db
        .select({
          id: planPurchases.id,
          status: planPurchases.status,
          purchasedAt: planPurchases.purchasedAt,
          activatedAt: planPurchases.activatedAt,
          expiresAt: planPurchases.expiresAt,
          name: plans.name,
          code: plans.code,
          description: plans.description,
          features: plans.features,
          durationDays: plans.durationDays,
          amountPaise: planPurchases.amountPaise,
          currency: planPurchases.currency,
        })
        .from(planPurchases)
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(eq(planPurchases.clientUserId, user.id))
        .orderBy(desc(planPurchases.createdAt)),
      db
        .select({
          id: coachAssignments.id,
          status: coachAssignments.status,
          coachUserId: coachAssignments.coachUserId,
          coachName: users.displayName,
          clientAvailableDays: coachAssignments.clientAvailableDays,
          clientPreferredTime: coachAssignments.clientPreferredTime,
          selectionWindowEndsAt: coachAssignments.selectionWindowEndsAt,
          applicationWindowEndsAt:
            coachAssignments.applicationWindowEndsAt,
          cycleNumber: coachAssignments.cycleNumber,
          refundEligibleAt: coachAssignments.refundEligibleAt,
          purchaseId: coachAssignments.purchaseId,
        })
        .from(coachAssignments)
        .leftJoin(users, eq(users.id, coachAssignments.coachUserId))
        .where(eq(coachAssignments.clientUserId, user.id))
        .orderBy(desc(coachAssignments.createdAt)),
      db
        .select()
        .from(coachSelectionRequests)
        .where(eq(coachSelectionRequests.clientUserId, user.id))
        .orderBy(desc(coachSelectionRequests.createdAt)),
      db
        .select()
        .from(serviceCycles)
        .where(eq(serviceCycles.clientUserId, user.id))
        .orderBy(desc(serviceCycles.startsAt)),
      db.select().from(coachingSessions).where(eq(coachingSessions.clientUserId, user.id)).orderBy(asc(coachingSessions.startsAt)),
      db.select().from(assessments).where(eq(assessments.clientUserId, user.id)).orderBy(desc(assessments.version)),
      db.select().from(paymentOrders).where(eq(paymentOrders.userId, user.id)).orderBy(desc(paymentOrders.createdAt)),
      db
        .select({ id: refunds.id, paymentOrderId: refunds.paymentOrderId, status: refunds.status })
        .from(refunds)
        .innerJoin(paymentOrders, eq(paymentOrders.id, refunds.paymentOrderId))
        .where(eq(paymentOrders.userId, user.id)),
      db.select().from(replacementRequests).where(eq(replacementRequests.requestedByUserId, user.id)).orderBy(desc(replacementRequests.createdAt)),
      getCompletedPreCoachingAssessment(user.id),
    ]);

  const latestDraft = assessmentRows.find((assessment) => assessment.status === "draft");
  const parsedInitialResponses = preCoachingDraftResponsesSchema.safeParse(
    latestDraft?.responses ?? completedAssessment?.responses ?? {},
  );
  const initialAssessmentResponses = parsedInitialResponses.success
    ? parsedInitialResponses.data
    : {};

  if (section === "assessment") {
    return (
      <>
        <PageIntro
          eyebrow="Private health profile"
          title="Pre-Coaching Assessment"
          description="This private assessment is optional for plan purchase but helps your coach train you more safely and personally."
        />
        <Panel>
          <AssessmentForm
            initialResponses={initialAssessmentResponses}
            completedAt={completedAssessment?.submittedAt?.toISOString() ?? null}
          />
        </Panel>
      </>
    );
  }

  if (section === "coaches") {
    const assignedAssignment = assignments.find(
      (row) => row.status === "assigned" && row.coachUserId,
    );
    const assignedCoachId = assignedAssignment?.coachUserId ?? null;
    const currentAssignment = assignments.find((row) =>
      ["selection", "open_pool"].includes(row.status),
    );
    const currentPlan = currentAssignment
      ? purchases.find((purchase) => purchase.id === currentAssignment.purchaseId)
      : null;
    const discoverableCoachCondition = and(
      activeCoachConditions(),
      eq(coachProfiles.acceptingClients, true),
      eq(users.status, "active"),
    );
    const availableRows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        languages: coachProfiles.languages,
        coachingModes: coachProfiles.coachingModes,
        availableDays: coachProfiles.availableDays,
        availableTimeSlots: coachProfiles.availableTimeSlots,
        state: coachProfiles.locationState,
        city: coachProfiles.locationCity,
        district: coachProfiles.locationDistrict,
        athleteExecutiveEligible: coachProfiles.athleteExecutiveEligible,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(
        assignedCoachId
          ? or(
              discoverableCoachCondition,
              eq(coachProfiles.userId, assignedCoachId),
            )
          : discoverableCoachCondition,
      )
      .orderBy(asc(users.displayName));
    const planEligible = currentPlan
      ? availableRows.filter((coach) =>
          coach.userId === assignedCoachId ||
          coachCanServePlan(coach, {
              code: currentPlan.code,
              name: currentPlan.name,
            }),
        )
      : availableRows;
    const dayOptions = [...new Set(planEligible.flatMap((coach) => coach.availableDays))]
      .sort((left, right) => {
        const leftIndex = coachAvailabilityDays.indexOf(left as CoachAvailabilityDay);
        const rightIndex = coachAvailabilityDays.indexOf(right as CoachAvailabilityDay);
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex) || left.localeCompare(right);
      });
    const preferredTimeOptions = coachAvailabilityTimeSlots
      .filter((slot) =>
        planEligible.some((coach) => coach.availableTimeSlots.includes(slot)),
      )
      .map((slot) => ({
        time: slot.split("-")[0],
        label: coachAvailabilityTimeSlotLabels[slot],
      }));
    const modeOptions = [...new Set(planEligible.flatMap((coach) => coach.coachingModes))]
      .sort((left, right) => left.localeCompare(right));
    const stateOptions = [...new Set(planEligible.map((coach) => coach.state).filter((value): value is string => Boolean(value)))]
      .sort((left, right) => left.localeCompare(right));
    const cityOptions = [...new Set(planEligible.map((coach) => coach.city).filter((value): value is string => Boolean(value)))]
      .sort((left, right) => left.localeCompare(right));
    const districtOptions = [...new Set(planEligible.map((coach) => coach.district).filter((value): value is string => Boolean(value)))]
      .sort((left, right) => left.localeCompare(right));
    const requestedDays = currentAssignment?.clientAvailableDays.length
      ? currentAssignment.clientAvailableDays
      : Array.isArray(filters.availableDays)
        ? filters.availableDays
        : filters.availableDays
          ? [filters.availableDays]
          : [];
    const selectedDays = [...new Set(requestedDays)].filter((day) =>
      dayOptions.includes(day),
    );
    const parsedPreferredTime = clientPreferredTimeSchema.safeParse(
      currentAssignment?.clientPreferredTime ?? filters.preferredTime ?? "",
    );
    const preferredTime = parsedPreferredTime.success && preferredTimeOptions.some((option) => option.time === parsedPreferredTime.data)
      ? parsedPreferredTime.data
      : "";
    const mode = modeOptions.includes(filters.mode ?? "") ? filters.mode ?? "" : "";
    const state = stateOptions.includes(filters.state ?? "") ? filters.state ?? "" : "";
    const city = cityOptions.includes(filters.city ?? "") ? filters.city ?? "" : "";
    const district = districtOptions.includes(filters.district ?? "") ? filters.district ?? "" : "";
    const available = planEligible.filter(
      (coach) =>
        (selectedDays.length === 0 ||
          selectedDays.some((day) => coach.availableDays.includes(day))) &&
        (!preferredTime ||
          coachMatchesClientAvailability(
            coach,
            selectedDays.length > 0 ? selectedDays : coach.availableDays,
            preferredTime,
          )) &&
        (!mode || coach.coachingModes.includes(mode)) &&
        (!state || coach.state === state) &&
        (!city || coach.city === city) &&
        (!district || coach.district === district),
    );
    const selectable =
      currentAssignment?.status === "selection" &&
      currentAssignment.selectionWindowEndsAt > new Date()
        ? currentAssignment
        : null;
    const currentRoundRequests = selectable
      ? selectionRequests.filter(
          (request) =>
            request.assignmentId === selectable.id &&
            request.selectionRound === selectable.cycleNumber,
        )
      : [];
    const pendingRequestCount = currentRoundRequests.filter(
      (request) => request.status === "pending",
    ).length;
    return (
      <>
        <PageIntro eyebrow="Verified professionals" title="Browse coaches" description={selectable ? `Send requests to up to three coaches before ${selectable.selectionWindowEndsAt.toLocaleString()}. The first coach to accept is assigned.` : "Review verified coaches and their current availability."} action={assignments.length === 0 ? <PrimaryLink href="/client/plan#available-plans">View plans</PrimaryLink> : undefined} />
        <div className={styles.infoBanner}>
          <MapPin size={19} aria-hidden="true" />
          <p>
            <strong>Choosing offline coaching?</strong> Before sending a coach request, make sure the coach&apos;s state, city, and district are suitable for where you will train.
          </p>
        </div>
        {currentAssignment?.status === "open_pool" ? <Empty text={`Your plan is in the six-day coach application pool until ${currentAssignment.applicationWindowEndsAt?.toLocaleString() ?? "the displayed deadline"}. Manual coach requests are paused.`} /> : (
          <Panel>
            <form className={styles.filterBar} method="get">
              <label>
                <span className="sr-only">Coaching mode</span>
                <select className={styles.filterButton} name="mode" defaultValue={mode}>
                  <option value="">All modes</option>
                  {modeOptions.map((option) => <option key={option} value={option}>{option === "online" ? "Online" : option === "offline" ? "Offline" : option}</option>)}
                </select>
              </label>
              <fieldset className={styles.dayFilterFieldset}>
                <legend>Available days (select one or more)</legend>
                <div className={styles.dayFilterChoices}>
                  {dayOptions.map((day) => <label key={day}><input type="checkbox" name="availableDays" value={day} defaultChecked={selectedDays.includes(day)} />{coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day}</label>)}
                </div>
              </fieldset>
              <label>
                <span className="sr-only">State</span>
                <select className={styles.filterButton} name="state" defaultValue={state}>
                  <option value="">All states</option>
                  {stateOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">City</span>
                <select className={styles.filterButton} name="city" defaultValue={city}>
                  <option value="">All cities</option>
                  {cityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">District</span>
                <select className={styles.filterButton} name="district" defaultValue={district}>
                  <option value="">All districts</option>
                  {districtOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className={styles.availabilityFilterField}>
                <span>Preferred one-hour time slot</span>
                <select className={styles.filterButton} name="preferredTime" defaultValue={preferredTime} required>
                  <option value="" disabled>Select one time slot</option>
                  {preferredTimeOptions.map((option) => <option key={option.time} value={option.time}>{option.label}</option>)}
                </select>
              </label>
              <button className={styles.primaryButton} type="submit">Apply filter</button>
              <Link className={styles.filterReset} href="/client/coaches">Reset</Link>
            </form>
            {available.length === 0 ? <Empty text="No active coach matches these availability filters." /> : (
          <DataTable headings={["Coach", "Mode", "State", "City", "District", "Available days", "Action"]}>
            {available.map((coach) => {
              const existingRequest = currentRoundRequests.find(
                (request) => request.coachUserId === coach.userId,
              );
              return (
                <tr className={coach.userId === assignedCoachId ? styles.assignedCoachRow : undefined} key={coach.userId}>
                  <td><Link className={styles.accountProfileLink} href={`/client/coaches/${coach.userId}`}><strong>{coach.displayName}</strong><small>{coach.userId === assignedCoachId ? "Your assigned coach" : "Open overview"}</small></Link></td>
                  <td><div className={styles.availabilityTags}>{coach.coachingModes.map((coachMode) => <span key={coachMode}>{coachMode === "online" ? "Online" : coachMode === "offline" ? "Offline" : coachMode}</span>)}</div></td>
                  <td className={styles.locationCell}>{coach.state ?? "Not provided"}</td>
                  <td className={styles.locationCell}>{coach.city ?? "Not provided"}</td>
                  <td className={styles.locationCell}>{coach.district ?? "Not provided"}</td>
                  <td className={styles.availabilityCell}><div className={styles.availabilityTags}>{coach.availableDays.map((day) => <span key={day}>{coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day}</span>)}</div></td>
                  <td>
                  {coach.userId === assignedCoachId ? (
                    <StatusBadge tone="success">Assigned coach</StatusBadge>
                  ) : existingRequest ? (
                    <StatusBadge
                      tone={
                        existingRequest.status === "pending"
                          ? "warning"
                          : existingRequest.status === "accepted"
                            ? "success"
                            : "neutral"
                      }
                    >
                      request {existingRequest.status}
                    </StatusBadge>
                  ) : selectable && selectedDays.length > 0 && preferredTime && pendingRequestCount < 3 ? (
                    <ActionButton
                      url={`/api/assignments/${selectable.id}/select-coach`}
                      body={{
                        coachUserId: coach.userId,
                        selectedDays,
                        selectedTime: preferredTime,
                      }}
                    >
                      Send coach request
                    </ActionButton>
                  ) : selectable && pendingRequestCount >= 3 ? (
                    <StatusBadge tone="warning">
                      Three requests pending
                    </StatusBadge>
                  ) : selectable ? (
                    <StatusBadge tone="warning">
                      Select days and one time above
                    </StatusBadge>
                  ) : null}
                  </td>
                </tr>
              );
            })}
          </DataTable>
            )}
          </Panel>
        )}
      </>
    );
  }

  if (section === "plan") {
    const currentPurchase = purchases.find((purchase) =>
      ["paid", "active"].includes(purchase.status),
    );
    const pastPurchases = purchases.filter(
      (purchase) => purchase.id !== currentPurchase?.id,
    );
    const currentAssignment = currentPurchase
      ? assignments.find(
          (assignment) => assignment.purchaseId === currentPurchase.id,
        )
      : null;
    const isAthleteExecutivePurchase = Boolean(
      currentPurchase?.code.startsWith("athlete-executive-"),
    );
    const isOnlineBasicPurchase = Boolean(
      currentPurchase?.code.startsWith("online-basic-"),
    );
    const [upgradeOffer, [latestUpgrade]] = await Promise.all([
      getOnlineBasicUpgradeOffer(user.id),
      db
        .select({
          id: planUpgrades.id,
          status: planUpgrades.status,
          amountPaise: planUpgrades.amountPaise,
          effectiveAt: planUpgrades.effectiveAt,
          paidAt: planUpgrades.paidAt,
          appliedAt: planUpgrades.appliedAt,
        })
        .from(planUpgrades)
        .where(eq(planUpgrades.clientUserId, user.id))
        .orderBy(desc(planUpgrades.createdAt))
        .limit(1),
    ]);
    const paymentMode =
      process.env.PAYMENTS_MODE === "provider"
        ? ("provider" as const)
        : process.env.APP_ENV !== "production" &&
            process.env.PAYMENTS_MODE === "mock"
          ? ("mock" as const)
          : ("unavailable" as const);
    return (
      <>
        <PageIntro
          eyebrow="Coaching plan"
          title={currentPurchase ? "Your plan" : "Choose your plan"}
          description={
            currentPurchase
              ? "Your purchased plan, activation status and fixed validity period."
              : "Compare the complete 3, 6, and 12-month catalogue before purchasing."
          }
          action={
            currentPurchase ? undefined : (
              <PrimaryLink href="#available-plans">View plans</PrimaryLink>
            )
          }
        />

        {currentPurchase ? (
          <section className={styles.planBanner}>
            <div className={styles.planBannerContent}>
              <p className={styles.darkEyebrow}>Current coaching plan</p>
              <h2>{currentPurchase.name}</h2>
              <p>{currentPurchase.description}</p>
              {currentPurchase.features.length > 0 ? (
                <div className={styles.planInclusions}>
                  <h3>What your plan includes</h3>
                  <ul>
                    {currentPurchase.features.map((feature) => (
                      <li key={feature}>
                        <CircleCheckBig size={14} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className={styles.planStatusMessage}>
                {currentPurchase.status === "active"
                  ? "Your coaching service is active and its validity is counting down."
                  : "Payment is complete. Your validity begins only when a coach accepts and is assigned."}
              </p>
              <div className={styles.planBannerStats}>
                <div className={styles.miniMetric}>
                  <span>Status</span>
                  <strong>
                    {currentPurchase.status === "active"
                      ? "Active"
                      : "Coach selection"}
                  </strong>
                </div>
                <div className={styles.miniMetric}>
                  <span>Validity</span>
                  <strong>{formatPlanDuration(currentPurchase.durationDays)}</strong>
                </div>
                <div className={styles.miniMetric}>
                  <span>Started</span>
                  <strong>
                    {currentPurchase.activatedAt
                      ? currentPurchase.activatedAt.toLocaleDateString("en-IN")
                      : "After assignment"}
                  </strong>
                </div>
                <div className={styles.miniMetric}>
                  <span>Valid until</span>
                  <strong>
                    {currentPurchase.expiresAt
                      ? currentPurchase.expiresAt.toLocaleDateString("en-IN")
                      : "Not started"}
                  </strong>
                </div>
              </div>
            </div>
            <div className={styles.planScore}>
              <span>Total paid</span>
              <strong>
                ₹{(currentPurchase.amountPaise / 100).toLocaleString("en-IN")}
              </strong>
              <small>
                Purchased {currentPurchase.purchasedAt?.toLocaleDateString("en-IN") ?? "recently"}
              </small>
              <PrimaryLink
                href={
                  currentPurchase.status === "paid"
                    ? "/client/coaches"
                    : "/client/schedule"
                }
              >
                {currentPurchase.status === "paid"
                  ? "Choose a coach"
                  : "View schedule"}
              </PrimaryLink>
            </div>
          </section>
        ) : (
          <div id="available-plans">
          <CheckoutPanel
            paymentMode={paymentMode}
          />
          </div>
        )}

        {upgradeOffer ? (
          <PlanUpgradePanel
            amountPaise={upgradeOffer.amountPaise}
            applicableCycles={upgradeOffer.applicableCycles}
            currentCycleNumber={upgradeOffer.currentCycleNumber}
            totalCycles={upgradeOffer.totalCycles}
            effectiveAt={upgradeOffer.effectiveAt.toISOString()}
            requestedOnCycleDayOne={upgradeOffer.requestedOnCycleDayOne}
            paymentMode={paymentMode}
          />
        ) : null}

        {latestUpgrade?.status === "scheduled" ? (
          <div className={styles.infoBanner}>
            <CalendarDays size={19} aria-hidden="true" />
            <p>
              <strong>Your Online Elite upgrade is scheduled.</strong> ₹
              {(latestUpgrade.amountPaise / 100).toLocaleString("en-IN")} was paid
              {latestUpgrade.paidAt
                ? ` on ${latestUpgrade.paidAt.toLocaleDateString("en-IN")}`
                : ""}. Online Elite becomes active on {latestUpgrade.effectiveAt.toLocaleString("en-IN")}.
              Your original expiry date remains unchanged.
            </p>
          </div>
        ) : null}

        {isOnlineBasicPurchase && currentPurchase?.status === "paid" ? (
          <div className={styles.infoBanner}>
            <CalendarDays size={19} aria-hidden="true" />
            <p>
              <strong>Online Elite upgrade availability.</strong> Your service
              cycles begin after a coach accepts your request. The upgrade
              price and activation date will appear here after assignment.
            </p>
          </div>
        ) : null}

        {isAthleteExecutivePurchase ? (
          <div className={styles.infoBanner}>
            <ShieldCheck size={19} aria-hidden="true" />
            <p>
              <strong>Choose an appropriately certified performance coach.</strong> Before sending a coach request, make sure the coach has suitable certification for Athlete / Executive Performance. Contact support if you need confirmation before choosing.
            </p>
          </div>
        ) : null}

        {currentPurchase?.status === "paid" && currentAssignment ? (
          <div className={styles.infoBanner}>
            <CircleCheckBig size={19} aria-hidden="true" />
            <p>
              <strong>Payment complete.</strong> Your {formatPlanDuration(currentPurchase.durationDays)} validity has not started yet. It starts when a coach accepts your request and the assignment becomes active.
            </p>
          </div>
        ) : null}

        {pastPurchases.length > 0 ? (
          <Panel>
            <PanelHeader
              title="Previous plans"
              description="Completed, cancelled and refunded plan history."
            />
            {pastPurchases.map((row) => (
              <article key={row.id} className={styles.attentionRow}>
                <div>
                  <h3>{row.name}</h3>
                  <p>
                    {formatPlanDuration(row.durationDays)} · ₹
                    {(row.amountPaise / 100).toLocaleString("en-IN")}
                    {row.expiresAt
                      ? ` · ended ${row.expiresAt.toLocaleDateString("en-IN")}`
                      : ""}
                  </p>
                </div>
                <StatusBadge tone="neutral">{row.status}</StatusBadge>
              </article>
            ))}
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            title="Payment history and refunds"
            description="Review plan transactions and submit an eligible refund request for administrator review. Refunds are never automatic."
          />
          <section className={styles.refundGuide} aria-labelledby="refund-guide-title">
            <div>
              <h3 id="refund-guide-title">When a refund can be requested</h3>
              <ul>
                <li>No coach was assigned during the initial 24-hour selection window and the following six-day coach pool.</li>
                <li>The coaching plan has not started because no coach has been assigned.</li>
                <li>The refund option is shown automatically beside the eligible captured payment.</li>
              </ul>
            </div>
            <div>
              <h3>How the refund process works</h3>
              <ol>
                <li>Enter your email and mobile number, then submit the full-refund request.</li>
                <li>Submitting the request stops the related coach-matching process.</li>
                <li>The administrator reviews the request and processes the refund manually. It is not issued automatically.</li>
                <li>The request status appears here after submission.</li>
              </ol>
            </div>
          </section>
          {payments.length === 0 ? (
            <Empty text="No payment records exist." />
          ) : (
            payments.map((payment) => {
              const refund = refundRows.find(
                (row) => row.paymentOrderId === payment.id,
              );
              const assignment = assignments.find(
                (row) => row.purchaseId === payment.purchaseId,
              );
              const refundEligible =
                payment.status === "captured" &&
                assignment?.status === "selection" &&
                Boolean(
                  assignment.refundEligibleAt &&
                    assignment.refundEligibleAt <= new Date(),
                );
              return (
                <article className={styles.attentionRow} key={payment.id}>
                  <div>
                    <h3>
                      {payment.purpose === "plan_upgrade"
                        ? "Online Elite upgrade payment"
                        : "Plan payment"}
                    </h3>
                    <p>
                      ₹{(payment.amountPaise / 100).toLocaleString("en-IN")} ·{" "}
                      {payment.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <StatusBadge
                      tone={payment.status === "captured" ? "success" : "neutral"}
                    >
                      {payment.status}
                    </StatusBadge>
                    {refundEligible && !refund ? (
                      <RefundRequestForm
                        paymentOrderId={payment.id}
                        defaultEmail={user.email}
                        defaultPhone={user.phone}
                      />
                    ) : null}
                    {refund ? (
                      <StatusBadge tone="warning">
                        refund {refund.status}
                      </StatusBadge>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </Panel>
      </>
    );
  }

  if (section === "schedule") {
    const groupSessions = await db.select({
      id: coachingGroupSessions.id,
      title: coachingGroupSessions.title,
      startsAt: coachingGroupSessions.startsAt,
      endsAt: coachingGroupSessions.endsAt,
      status: coachingGroupSessions.status,
      meetingProvider: coachingGroupSessions.meetingProvider,
      providerRoomId: coachingGroupSessions.providerRoomId,
      rescheduledAt: coachingGroupSessions.rescheduledAt,
      groupName: coachingGroups.name,
    }).from(coachingGroupSessions)
      .innerJoin(coachingGroups, eq(coachingGroups.id, coachingGroupSessions.groupId))
      .innerJoin(coachingGroupMembers, and(
        eq(coachingGroupMembers.groupId, coachingGroups.id),
        eq(coachingGroupMembers.clientUserId, user.id),
      ))
      .innerJoin(coachAssignments, and(
        eq(coachAssignments.id, coachingGroupMembers.assignmentId),
        eq(coachAssignments.status, "assigned"),
        eq(coachAssignments.coachUserId, coachingGroups.coachUserId),
      ))
      .innerJoin(planPurchases, and(
        eq(planPurchases.id, coachAssignments.purchaseId),
        eq(planPurchases.status, "active"),
        gt(planPurchases.expiresAt, new Date()),
      ))
      .innerJoin(plans, and(
        eq(plans.id, planPurchases.planId),
        like(plans.code, "group-online-coaching-%"),
      ))
      .orderBy(asc(coachingGroupSessions.startsAt));
    const allSessions = [
      ...sessions.map((session) => ({ kind: "individual" as const, startsAt: session.startsAt, session })),
      ...groupSessions.map((session) => ({ kind: "group" as const, startsAt: session.startsAt, session })),
    ].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    return <><PageIntro eyebrow="Coaching sessions" title="Schedule" description="View individual and group sessions, with times shown in your local timezone, and join Google Meet during the secure access window." /><Panel>{allSessions.length === 0 ? <Empty text="No sessions have been scheduled." /> : <div className={styles.sessionList}>{allSessions.map((item) => item.kind === "individual" ? <SessionCard key={`individual-${item.session.id}`} role="client" session={{ id: item.session.id, title: item.session.title, mode: item.session.mode, startsAt: item.session.startsAt.toISOString(), endsAt: item.session.endsAt.toISOString(), status: item.session.status, meetingProvider: item.session.meetingProvider, hasMeetingLink: Boolean(item.session.providerRoomId), rescheduledAt: item.session.rescheduledAt?.toISOString() ?? null, cancellationReason: item.session.cancellationReason }} /> : <SessionCard key={`group-${item.session.id}`} role="client" counterpartyName={item.session.groupName} joinUrl={`/api/group-sessions/${item.session.id}/join`} accessNote="Access is limited to the assigned coach and currently eligible members of this group." session={{ id: item.session.id, title: item.session.title, mode: "online", startsAt: item.session.startsAt.toISOString(), endsAt: item.session.endsAt.toISOString(), status: item.session.status, meetingProvider: item.session.meetingProvider, hasMeetingLink: Boolean(item.session.providerRoomId), rescheduledAt: item.session.rescheduledAt?.toISOString() ?? null }} />)}</div>}</Panel></>;
  }

  if (section === "replacement") {
    const active = assignments.find((row) => row.status === "assigned");
    const activePlan = active
      ? purchases.find((purchase) => purchase.id === active.purchaseId)
      : null;
    const currentCycle = active
      ? serviceCycleRows.find(
          (cycle) =>
            cycle.assignmentId === active.id && cycle.status === "active",
        )
      : null;
    const hasNextCycle = Boolean(
      currentCycle &&
        serviceCycleRows.some(
          (cycle) =>
            cycle.purchaseId === currentCycle.purchaseId &&
            cycle.cycleNumber === currentCycle.cycleNumber + 1,
        ),
    );
    const blockingRequest = currentCycle
      ? replacementRows.find(
          (row) =>
            row.cycleNumber === currentCycle.cycleNumber &&
            ["requested", "approved"].includes(row.status),
        )
      : null;
    const desiredCoachIds = replacementRows
      .map((row) => row.desiredCoachUserId)
      .filter((id): id is string => Boolean(id));
    const desiredCoachRows =
      desiredCoachIds.length > 0
        ? await db
            .select({ id: users.id, name: users.displayName })
            .from(users)
            .where(inArray(users.id, desiredCoachIds))
        : [];
    const desiredCoachNames = new Map(
      desiredCoachRows.map((coach) => [coach.id, coach.name]),
    );
    const availableCoachRows =
      active?.coachUserId && currentCycle && hasNextCycle && !blockingRequest
        ? await db
            .select({
              userId: users.id,
              displayName: users.displayName,
              availableDays: coachProfiles.availableDays,
              availableTimeSlots: coachProfiles.availableTimeSlots,
              state: coachProfiles.locationState,
              city: coachProfiles.locationCity,
              district: coachProfiles.locationDistrict,
              athleteExecutiveEligible:
                coachProfiles.athleteExecutiveEligible,
            })
            .from(coachProfiles)
            .innerJoin(users, eq(users.id, coachProfiles.userId))
            .where(
              and(
                activeCoachConditions(),
                eq(coachProfiles.acceptingClients, true),
                eq(users.status, "active"),
                ne(coachProfiles.userId, active.coachUserId),
              ),
            )
            .orderBy(asc(users.displayName))
        : [];
    const availableCoaches = activePlan
      ? availableCoachRows.filter((coach) =>
          coachCanServePlan(coach, {
            code: activePlan.code,
            name: activePlan.name,
          }),
        )
      : availableCoachRows;
    return (
      <>
        <PageIntro
          eyebrow="Next-cycle coaching"
          title="Switch coach"
          description="Your current coach remains responsible for the complete active 30-day cycle. An accepted switch takes effect only when the next cycle begins."
        />
        <section className={styles.dashboardTwoColumn}>
          <Panel>
            <PanelHeader title="Current cycle" />
            {!active || !currentCycle ? (
              <Empty text="No active service cycle is available." />
            ) : (
              <div className={styles.overviewDetails}>
                <p><strong>Coach</strong>{active.coachName}</p>
                <p><strong>Cycle</strong>{currentCycle.cycleNumber}</p>
                <p><strong>Cycle ends</strong>{currentCycle.endsAt.toLocaleString()}</p>
              </div>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Request status" />
            {blockingRequest ? (
              <div className={styles.overviewDetails}>
                <p>
                  <strong>Desired coach</strong>
                  {blockingRequest.desiredCoachUserId
                    ? desiredCoachNames.get(blockingRequest.desiredCoachUserId)
                    : "Coach"}
                </p>
                <p><strong>Status</strong>{switchStatusLabel(blockingRequest.status)}</p>
                {blockingRequest.status === "requested" ? (
                  <p>
                    <strong>Response due</strong>
                    {blockingRequest.responseDeadlineAt?.toLocaleString()}
                  </p>
                ) : (
                  <p><strong>Effective</strong>Next 30-day cycle</p>
                )}
              </div>
            ) : (
              <p>No pending or accepted request exists for this cycle.</p>
            )}
          </Panel>
        </section>
        {active && currentCycle && hasNextCycle && !blockingRequest ? (
          <Panel>
            <CoachSwitchRequestForm
              assignmentId={active.id}
              coaches={availableCoaches.map((coach) => ({
                userId: coach.userId,
                displayName: coach.displayName,
                availableDays: coach.availableDays,
                availableTimeSlots: coach.availableTimeSlots,
                location:
                  [coach.district, coach.city, coach.state]
                    .filter(Boolean)
                    .join(", ") || "Location not provided",
              }))}
            />
          </Panel>
        ) : currentCycle && !hasNextCycle ? (
          <Panel>
            <Empty text="This is the final service cycle in the plan, so there is no later cycle to switch into." />
          </Panel>
        ) : null}
        {replacementRows.length > 0 ? (
          <Panel>
            <PanelHeader title="Request history" />
            {replacementRows.map((row) => (
              <article className={styles.attentionRow} key={row.id}>
                <div>
                  <h3>
                    {row.desiredCoachUserId
                      ? desiredCoachNames.get(row.desiredCoachUserId) ??
                        "Selected coach"
                      : "Legacy request"}
                  </h3>
                  <p>
                    Cycle {row.cycleNumber ?? "—"} · {row.reasonCode} ·{" "}
                    {row.createdAt.toLocaleString()}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    row.status === "approved"
                      ? "success"
                      : row.status === "declined" ||
                          row.status === "completed"
                        ? "danger"
                        : "warning"
                  }
                >
                  {switchStatusLabel(row.status)}
                </StatusBadge>
              </article>
            ))}
          </Panel>
        ) : null}
      </>
    );
  }

  if (section === "settings") {
    const profilePhotoUrl = await getProfilePhotoUrl(user.id);
    return <><PageIntro eyebrow="Account" title="Settings" description="Manage your account details and profile photo." /><section className={styles.dashboardTwoColumn}><Panel><ProfilePhotoForm currentPhotoUrl={profilePhotoUrl} displayName={user.displayName} /></Panel><Panel><PanelHeader title="Account details" /><p>Signed in as <strong>{user.displayName}</strong> (@{user.username}). Password recovery is available from the sign-in page.</p></Panel></section></>;
  }

  const activeAssignment = assignments.find((row) => row.status === "assigned");
  const activeServiceCycle = activeAssignment
    ? serviceCycleRows.find(
        (cycle) =>
          cycle.assignmentId === activeAssignment.id &&
          cycle.status === "active",
      )
    : null;
  const nextSession = sessions.find((row) => row.status === "scheduled" && row.startsAt > new Date());
  return (
    <>
      <PageIntro eyebrow="Client workspace" title={`Welcome, ${user.displayName}.`} description="This dashboard only reflects records created in your account." action={<PrimaryLink href="/client/coaches">Find a coach</PrimaryLink>} />
      <Panel className={styles.clientOverviewPanel}>
        <PanelHeader
          title="Profile overview"
          description="Your registration details"
        />
        <div className={styles.clientOverviewDetails}>
          <div>
            <span>State</span>
            <strong>{clientProfile?.state ?? "Not provided"}</strong>
          </div>
          <div>
            <span>City</span>
            <strong>{clientProfile?.city ?? "Not provided"}</strong>
          </div>
          <div>
            <span>District</span>
            <strong>{clientProfile?.district ?? "Not provided"}</strong>
          </div>
          <div>
            <span>Mobile number</span>
            <strong>{user.phone ?? "Not provided"}</strong>
          </div>
          <p>
            <MapPin size={15} aria-hidden="true" />
            Location is visible to your assigned coach.
          </p>
        </div>
      </Panel>
      <section className={styles.statGrid}>
        <StatCard label="Plans" value={String(purchases.length)} detail="All purchases" icon={CreditCard} />
        <StatCard label="Coach" value={activeAssignment?.coachName ?? "Not assigned"} detail={activeServiceCycle ? `Cycle ${activeServiceCycle.cycleNumber} ends ${activeServiceCycle.endsAt.toLocaleDateString()}` : activeAssignment?.status ?? "No assignment"} icon={Target} tone="black" />
        <StatCard label="Sessions" value={String(sessions.length)} detail={nextSession ? nextSession.startsAt.toLocaleDateString() : "None scheduled"} icon={CalendarDays} tone="green" />
        <StatCard label="Assessment" value={completedAssessment ? "Complete" : "Pending"} detail={completedAssessment ? "Update when your health changes" : "Recommended for safer coaching"} icon={CircleCheckBig} tone="orange" />
      </section>
      <section className={styles.dashboardTwoColumn}>
        <Panel><PanelHeader title="Health assessment" description={completedAssessment ? "Your health assessment is complete. Update it if your condition changes." : "This assessment is optional for purchase but strongly recommended before coaching begins."} /><PrimaryLink href="/client/assessment">{completedAssessment ? "Review assessment" : "Complete assessment"}</PrimaryLink></Panel>
        <Panel><PanelHeader title="Current assignment" />{assignments.length === 0 ? <Empty text="No assignment exists. Purchase a plan to begin coaching." action={<PrimaryLink href="/client/plan#available-plans">View plans</PrimaryLink>} /> : assignments.map((row) => { const cycle = serviceCycleRows.find((item) => item.assignmentId === row.id && item.status === "active"); const deadline = row.status === "selection" ? row.selectionWindowEndsAt : row.status === "open_pool" ? row.applicationWindowEndsAt : null; const refundNote = row.status === "selection" && row.refundEligibleAt && row.refundEligibleAt <= new Date() ? " · refund available in My Plan" : ""; const phaseText = row.status === "assigned" && cycle ? `Cycle ${cycle.cycleNumber} · ${cycle.startsAt.toLocaleDateString()} to ${cycle.endsAt.toLocaleDateString()}` : row.status === "selection" ? `Choose a coach before ${deadline?.toLocaleString()} · cycle ${row.cycleNumber}${refundNote}` : row.status === "open_pool" ? `Coach applications close ${deadline?.toLocaleString()} · manual selection paused · cycle ${row.cycleNumber}` : row.status === "cancelled" ? "Matching ended after your refund request." : row.status; return <article className={styles.attentionRow} key={row.id}><div><h3>{row.coachName ?? (row.status === "open_pool" ? "Coaches can now apply" : "Coach not selected")}</h3><p>{phaseText}</p></div><StatusBadge tone={row.status === "assigned" ? "success" : row.status === "cancelled" ? "danger" : "warning"}>{row.status.replace("_", " ")}</StatusBadge></article>; })}</Panel>
      </section>
    </>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return <div className={styles.emptyCompact}><ShieldCheck size={22} /><div><h3>Nothing here yet</h3><p>{text}</p></div>{action}</div>;
}

function switchStatusLabel(status: string) {
  if (status === "approved") return "accepted";
  if (status === "declined") return "rejected";
  if (status === "completed") return "expired";
  return status;
}
