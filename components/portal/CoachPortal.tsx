import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import Link from "next/link";
import {
  CalendarCheck2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachCertifications,
  coachProfiles,
  coachSelectionRequests,
  coachSpecialties,
  coachingSessions,
  coachingGroupMembers,
  coachingGroups,
  coachingGroupSessions,
  clientProfiles,
  planPurchases,
  plans,
  replacementRequests,
  serviceCycles,
  users,
} from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/session";
import { reconcileDueAssignmentLifecycles } from "@/lib/assignments/lifecycle";
import {
  coachMatchesClientAvailability,
  formatClientPreferredSlot,
} from "@/lib/assignments/client-availability";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";
import {
  coachAvailabilityDayLabels,
  coachAvailabilityTimeSlotLabels,
  isCoachProfileActive,
  type CoachAvailabilityDay,
  type CoachAvailabilityTimeSlot,
} from "@/lib/coaches/activation";
import { hasCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import {
  coachQualificationDisplayName,
  type CoachQualificationType,
} from "@/lib/coaches/certifications";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";
import { formatPlanDuration } from "@/lib/plans/duration";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoachActivationManager } from "./ActivationActions";
import { CoachCertificationManager } from "./CertificationActions";
import {
  ActionButton,
  CoachProfileForm,
  SessionCreateForm,
} from "./PortalActions";
import {
  Panel,
  PanelHeader,
  PrimaryLink,
  SecondaryLink,
  StatCard,
  StatusBadge,
} from "./PortalPrimitives";
import { PageIntro } from "./PortalShell";
import { ProfilePhotoForm } from "./ProfilePhotoForm";
import { SessionCard } from "./SessionManager";
import { GroupCoachingManager } from "./GroupCoachingManager";
import styles from "./portal.module.css";

export async function CoachPortalPage({
  section = "overview",
  scheduleAssignmentId,
}: {
  section?: string;
  scheduleAssignmentId?: string;
}) {
  const user = await getCurrentAppUser();
  if (!user) return null;
  const db = getDb();
  await reconcileDueAssignmentLifecycles();
  await reconcileDueServiceCycles();
  const [
    [profile],
    specialties,
    assignments,
    sessions,
    certifications,
    profilePhotoUrl,
  ] = await Promise.all([
    db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, user.id))
      .limit(1),
    db
      .select({ specialty: coachSpecialties.specialty })
      .from(coachSpecialties)
      .where(eq(coachSpecialties.coachUserId, user.id)),
    db
      .select({
        id: coachAssignments.id,
        status: coachAssignments.status,
        clientUserId: coachAssignments.clientUserId,
        clientName: users.displayName,
        assignedAt: coachAssignments.assignedAt,
        clientAvailableDays: coachAssignments.clientAvailableDays,
        clientPreferredTime: coachAssignments.clientPreferredTime,
        planName: plans.name,
        planCode: plans.code,
        purchaseStatus: planPurchases.status,
        purchaseExpiresAt: planPurchases.expiresAt,
      })
      .from(coachAssignments)
      .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
      .innerJoin(
        planPurchases,
        eq(planPurchases.id, coachAssignments.purchaseId),
      )
      .innerJoin(plans, eq(plans.id, planPurchases.planId))
      .where(eq(coachAssignments.coachUserId, user.id))
      .orderBy(desc(coachAssignments.updatedAt)),
    db
      .select()
      .from(coachingSessions)
      .where(eq(coachingSessions.coachUserId, user.id))
      .orderBy(asc(coachingSessions.startsAt)),
    db
      .select()
      .from(coachCertifications)
      .where(eq(coachCertifications.coachUserId, user.id))
      .orderBy(asc(coachCertifications.createdAt)),
    getProfilePhotoUrl(user.id),
  ]);
  if (!profile) return null;

  const activeAssignments = assignments
    .filter((row) => row.status === "assigned")
    .sort((left, right) => {
      const leftTime = left.clientPreferredTime ?? "99:99";
      const rightTime = right.clientPreferredTime ?? "99:99";
      return leftTime.localeCompare(rightTime) || left.clientName.localeCompare(right.clientName);
    });
  const certificationVerified = Boolean(
    profile.approvedAt || profile.certificationWaivedAt,
  );
  const profileActive = isCoachProfileActive(profile);
  const serviceAccessActive = hasCurrentCoachServiceAccess(profile);
  const activationPeriodCurrent = Boolean(
    profile.activationExpiresAt && profile.activationExpiresAt > new Date(),
  );
  const approvedCertifications = certifications.filter(
    (certification) => certification.verificationStatus === "approved",
  );

  if (section === "certification") {
    const storage = createAdminClient().storage.from("coach-certificates");
    const certificationRows = await Promise.all(
      certifications.map(async (certification) => {
        const { data } = await storage.createSignedUrl(
          certification.storagePath,
          10 * 60,
        );
        return { ...certification, url: data?.signedUrl ?? null };
      }),
    );
    return (
      <>
        <PageIntro
          eyebrow="Identity verification"
          title="Coach certification"
          description="Upload one or more eligible qualifications. The administrator accepts or rejects each submitted group together."
        />
        <Panel>
          <CoachCertificationManager
            status={profile.approvalStatus}
            rejectionReason={profile.rejectionReason}
            reviewMessage={profile.certificationReviewMessage}
            certifications={certificationRows}
          />
        </Panel>
      </>
    );
  }

  if (section === "activation") {
    return (
      <>
        <PageIntro
          eyebrow="Coach profile access"
          title="Activate profile"
          description="Manage your location and coaching availability, then choose a 30, 90, or 365-day activation plan."
        />
        <Panel>
          <CoachActivationManager
            certificationVerified={certificationVerified}
            certificationWaived={Boolean(profile.certificationWaivedAt)}
            active={profileActive}
            activationPeriodCurrent={activationPeriodCurrent}
            activationExpiresAt={
              profile.activationExpiresAt?.toISOString() ?? null
            }
            availableDays={profile.availableDays}
            availableTimeSlots={profile.availableTimeSlots}
            locationState={profile.locationState}
            locationCity={profile.locationCity}
            locationDistrict={profile.locationDistrict}
            paymentMode={
              process.env.PAYMENTS_MODE === "provider"
                ? "provider"
                : process.env.APP_ENV !== "production" &&
                    process.env.PAYMENTS_MODE === "mock"
                  ? "mock"
                  : "unavailable"
            }
          />
        </Panel>
      </>
    );
  }

  if (
    !serviceAccessActive &&
    ["clients", "opportunities", "switch-requests", "schedule", "groups"].includes(
      section,
    )
  ) {
    return (
      <>
        <PageIntro
          eyebrow="Coach account inactive"
          title="Reactivate to continue coaching"
          description="Your client assignments are safely preserved, but client details, groups, and session tools are locked until a new activation begins."
          action={<PrimaryLink href="/coach/activation">Reactivate account</PrimaryLink>}
        />
        <Panel>
          <p>
            Reactivation restores access to the same assigned clients immediately.
            No client is removed or reassigned simply because activation expired.
          </p>
        </Panel>
      </>
    );
  }

  if (section === "clients") {
    return (
      <>
        <PageIntro
          eyebrow="Client roster"
          title="My clients"
          description="Only clients currently assigned to this coach account are shown."
        />
        <Panel>
          {activeAssignments.length === 0 ? (
            <Empty text="No clients are assigned yet." />
          ) : (
            activeAssignments.map((row) => (
              <article className={styles.clientRosterRow} key={row.id}>
                <div>
                  <h3><Link className={styles.profileNameLink} href={`/coach/clients/${row.clientUserId}`}>{row.clientName}</Link></h3>
                  <p>
                    {row.planName}
                    {row.assignedAt
                      ? ` · assigned ${row.assignedAt.toLocaleDateString()}`
                      : ""}
                  </p>
                  <p>
                    {row.clientAvailableDays.length > 0
                      ? row.clientAvailableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ")
                      : "Days not selected"}
                    {` · ${formatClientPreferredSlot(row.clientPreferredTime)}`}
                  </p>
                </div>
                <div className={styles.clientRosterActions}>
                  <StatusBadge tone="success">assigned</StatusBadge>
                  <SecondaryLink href={`/coach/clients/${row.clientUserId}`}>
                    Open overview
                  </SecondaryLink>
                  <PrimaryLink href={`/coach/schedule?assignmentId=${row.id}`}>
                    Schedule session
                  </PrimaryLink>
                </div>
              </article>
            ))
          )}
        </Panel>
      </>
    );
  }

  if (section === "opportunities") {
    const directRequestRows =
      profileActive && profile.acceptingClients
        ? await db
            .select({
              id: coachSelectionRequests.id,
              assignmentId: coachAssignments.id,
              clientUserId: coachAssignments.clientUserId,
              clientName: users.displayName,
              planCode: plans.code,
              planName: plans.name,
              durationDays: plans.durationDays,
              clientAvailableDays: coachAssignments.clientAvailableDays,
              clientPreferredTime: coachAssignments.clientPreferredTime,
              expiresAt: coachSelectionRequests.expiresAt,
              state: clientProfiles.locationState,
              city: clientProfiles.locationCity,
              district: clientProfiles.locationDistrict,
            })
            .from(coachSelectionRequests)
            .innerJoin(
              coachAssignments,
              eq(coachAssignments.id, coachSelectionRequests.assignmentId),
            )
            .innerJoin(
              planPurchases,
              eq(planPurchases.id, coachAssignments.purchaseId),
            )
            .innerJoin(plans, eq(plans.id, planPurchases.planId))
            .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
            .leftJoin(
              clientProfiles,
              eq(clientProfiles.userId, coachAssignments.clientUserId),
            )
            .where(
              and(
                eq(coachSelectionRequests.coachUserId, user.id),
                eq(coachSelectionRequests.status, "pending"),
                gt(coachSelectionRequests.expiresAt, new Date()),
                eq(coachAssignments.status, "selection"),
                eq(planPurchases.status, "paid"),
              ),
            )
            .orderBy(asc(coachSelectionRequests.expiresAt))
        : [];
    const directRequests = directRequestRows.filter((request) =>
      coachCanServePlan(profile, {
        code: request.planCode,
        name: request.planName,
      }),
    );
    const opportunityRows =
      profileActive && profile.acceptingClients
        ? await db
            .select({
              id: coachAssignments.id,
              clientUserId: coachAssignments.clientUserId,
              clientName: users.displayName,
              planCode: plans.code,
              planName: plans.name,
              coachingMode: plans.coachingMode,
              durationDays: plans.durationDays,
              clientAvailableDays: coachAssignments.clientAvailableDays,
              clientPreferredTime: coachAssignments.clientPreferredTime,
              updatedAt: coachAssignments.updatedAt,
              applicationWindowEndsAt:
                coachAssignments.applicationWindowEndsAt,
              cycleNumber: coachAssignments.cycleNumber,
              state: clientProfiles.locationState,
              city: clientProfiles.locationCity,
              district: clientProfiles.locationDistrict,
            })
            .from(coachAssignments)
            .innerJoin(
              planPurchases,
              eq(planPurchases.id, coachAssignments.purchaseId),
            )
            .innerJoin(plans, eq(plans.id, planPurchases.planId))
            .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
            .leftJoin(
              clientProfiles,
              eq(clientProfiles.userId, coachAssignments.clientUserId),
            )
            .where(
              and(
                eq(coachAssignments.status, "open_pool"),
                eq(planPurchases.status, "paid"),
                or(
                  isNull(coachAssignments.applicationWindowEndsAt),
                  gt(coachAssignments.applicationWindowEndsAt, new Date()),
                ),
              ),
            )
            .orderBy(asc(coachAssignments.updatedAt))
        : [];
    const opportunities = opportunityRows.filter(
      (opportunity) =>
        coachCanServePlan(profile, {
          code: opportunity.planCode,
          name: opportunity.planName,
        }) &&
        (!opportunity.clientPreferredTime ||
          opportunity.clientAvailableDays.length === 0 ||
          coachMatchesClientAvailability(
            profile,
            opportunity.clientAvailableDays,
            opportunity.clientPreferredTime,
          )),
    );
    return (
      <>
        <PageIntro
          eyebrow="Client matching"
          title="Coaching opportunities"
          description="Review client overviews, respond to direct requests, or apply to clients in the six-day pool."
        />
        {!profileActive ? (
          <Empty text="Accepted certification (or an admin waiver) and a current activation period are required before opportunities become available." />
        ) : !profile.acceptingClients ? (
          <Empty text="Enable accepting clients in your public profile to view opportunities." />
        ) : (
          <>
            <Panel>
              <PanelHeader
                title="Direct client requests"
                description={`${directRequests.length} awaiting your response`}
              />
              {directRequests.length === 0 ? (
                <Empty text="No client has requested you during a 24-hour selection window." />
              ) : (
                <section className={styles.clientOpportunityList}>
                  {directRequests.map((row) => (
                    <article className={styles.clientOpportunityRow} key={row.id}>
                      <div className={styles.clientOpportunityIdentity}>
                        <span className={styles.listAvatar} aria-hidden="true">{row.clientName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                        <div>
                        <h3><Link className={styles.profileNameLink} href={`/coach/opportunities/${row.assignmentId}`}>{row.clientName}</Link></h3>
                        <p>
                          {row.planName} · {formatPlanDuration(row.durationDays)}
                        </p>
                        <p>
                          Availability: {row.clientAvailableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ") || "days not selected"} · {formatClientPreferredSlot(row.clientPreferredTime)}
                        </p>
                        <p>
                          {[row.district, row.city, row.state]
                            .filter(Boolean)
                            .join(", ") || "Location not provided"}{" "}
                          · respond by {row.expiresAt.toLocaleString()}
                        </p>
                        </div>
                      </div>
                      <div className={styles.inlineActions}>
                        <ActionButton
                          url={`/api/assignments/requests/${row.id}/respond`}
                          body={{ decision: "accept" }}
                        >
                          Accept
                        </ActionButton>
                        <ActionButton
                          tone="secondary"
                          url={`/api/assignments/requests/${row.id}/respond`}
                          body={{ decision: "reject" }}
                        >
                          Reject
                        </ActionButton>
                      </div>
                    </article>
                  ))}
                </section>
              )}
            </Panel>
            <Panel>
              <PanelHeader
                title="Six-day client pool"
                description={`${opportunities.length} available`}
              />
              {opportunities.length === 0 ? (
                <Empty text="No open-pool assignments are available." />
              ) : (
                <section className={styles.clientOpportunityList}>
                  {opportunities.map((row) => (
                    <article className={styles.clientOpportunityRow} key={row.id}>
                      <div className={styles.clientOpportunityIdentity}>
                        <span className={styles.listAvatar} aria-hidden="true">{row.clientName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                        <div>
                      <h3><Link className={styles.profileNameLink} href={`/coach/opportunities/${row.id}`}>{row.clientName}</Link></h3>
                      <p>{row.planName}</p>
                      <p>
                        Availability: {row.clientAvailableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ") || "days not selected"} · {formatClientPreferredSlot(row.clientPreferredTime)}
                      </p>
                      <p>
                        {formatPlanDuration(row.durationDays)} · {row.coachingMode}
                      </p>
                      <p>
                        {[row.district, row.city, row.state]
                          .filter(Boolean)
                          .join(", ") || "Location not provided"}
                      </p>
                      <p>
                        Application closes{" "}
                        {row.applicationWindowEndsAt?.toLocaleString()} · round{" "}
                        {row.cycleNumber}
                      </p>
                        </div>
                      </div>
                      <ActionButton url={`/api/assignments/${row.id}/claim`}>
                        Apply and accept
                      </ActionButton>
                    </article>
                  ))}
                </section>
              )}
            </Panel>
          </>
        )}
      </>
    );
  }

  if (section === "switch-requests") {
    const requests = await db
      .select({
        id: replacementRequests.id,
        clientName: users.displayName,
        reasonCode: replacementRequests.reasonCode,
        reason: replacementRequests.privateDetails,
        cycleNumber: replacementRequests.cycleNumber,
        responseDeadlineAt: replacementRequests.responseDeadlineAt,
      })
      .from(replacementRequests)
      .innerJoin(
        coachAssignments,
        eq(coachAssignments.id, replacementRequests.assignmentId),
      )
      .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
      .innerJoin(
        serviceCycles,
        and(
          eq(serviceCycles.assignmentId, replacementRequests.assignmentId),
          eq(serviceCycles.cycleNumber, replacementRequests.cycleNumber),
        ),
      )
      .where(
        and(
          eq(replacementRequests.desiredCoachUserId, user.id),
          eq(replacementRequests.status, "requested"),
          gt(replacementRequests.responseDeadlineAt, new Date()),
          eq(serviceCycles.status, "active"),
        ),
      )
      .orderBy(asc(replacementRequests.responseDeadlineAt));
    return (
      <>
        <PageIntro
          eyebrow="Next-cycle requests"
          title="Coach switch requests"
          description="Accepting reserves the next 30-day cycle. It never changes the client's coach during their current cycle."
        />
        {requests.length === 0 ? (
          <Empty text="No client switch requests are awaiting your response." />
        ) : (
          <section className={styles.opportunityGrid}>
            {requests.map((row) => (
              <Panel key={row.id}>
                <h2>{row.clientName}</h2>
                <p>
                  Requested during cycle {row.cycleNumber}. Response due{" "}
                  {row.responseDeadlineAt?.toLocaleString()}.
                </p>
                <p>
                  <strong>{row.reasonCode.replace("_", " ")}</strong>
                  <br />
                  {row.reason}
                </p>
                <div className={styles.inlineActions}>
                  <ActionButton
                    url={`/api/replacements/${row.id}/respond`}
                    body={{ decision: "accept" }}
                  >
                    Accept for next cycle
                  </ActionButton>
                  <ActionButton
                    tone="secondary"
                    url={`/api/replacements/${row.id}/respond`}
                    body={{ decision: "reject" }}
                  >
                    Reject
                  </ActionButton>
                </div>
              </Panel>
            ))}
          </section>
        )}
      </>
    );
  }

  if (section === "schedule") {
    return (
      <>
        <PageIntro
          eyebrow="Client sessions"
          title="Schedule"
          description="Create sessions only for active assignments."
        />
        <section className={styles.dashboardTwoColumn}>
          <Panel>
            <PanelHeader title="Schedule a session" />
            <SessionCreateForm
              assignments={activeAssignments.map(({ id, clientName, clientPreferredTime }) => ({
                id,
                clientName,
                preferredTime: clientPreferredTime,
              }))}
              defaultAssignmentId={scheduleAssignmentId}
            />
          </Panel>
          <Panel>
            <PanelHeader title="Sessions" />
            {sessions.length === 0 ? (
              <Empty text="No sessions are scheduled." />
            ) : (
              <div className={styles.sessionList}>
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    role="coach"
                    session={{
                      id: session.id,
                      title: session.title,
                      mode: session.mode,
                      startsAt: session.startsAt.toISOString(),
                      endsAt: session.endsAt.toISOString(),
                      status: session.status,
                      meetingProvider: session.meetingProvider,
                      hasMeetingLink: Boolean(session.providerRoomId),
                      rescheduledAt:
                        session.rescheduledAt?.toISOString() ?? null,
                      cancellationReason: session.cancellationReason,
                    }}
                  />
                ))}
              </div>
            )}
          </Panel>
        </section>
      </>
    );
  }

  if (section === "groups") {
    const [groupRows, memberRows, groupSessionRows] = await Promise.all([
      db.select().from(coachingGroups).where(eq(coachingGroups.coachUserId, user.id)).orderBy(asc(coachingGroups.createdAt)),
      db.select({
        groupId: coachingGroupMembers.groupId,
        id: coachingGroupMembers.assignmentId,
        clientUserId: coachingGroupMembers.clientUserId,
        clientName: users.displayName,
        planName: plans.name,
        coachUserId: coachAssignments.coachUserId,
      }).from(coachingGroupMembers)
        .innerJoin(coachAssignments, eq(coachAssignments.id, coachingGroupMembers.assignmentId))
        .innerJoin(users, eq(users.id, coachingGroupMembers.clientUserId))
        .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(eq(coachAssignments.coachUserId, user.id)),
      db.select().from(coachingGroupSessions).where(eq(coachingGroupSessions.coachUserId, user.id)).orderBy(asc(coachingGroupSessions.startsAt)),
    ]);
    const eligibleAssignments = assignments.filter((assignment) =>
      assignment.status === "assigned" &&
      assignment.purchaseStatus === "active" &&
      Boolean(assignment.purchaseExpiresAt && assignment.purchaseExpiresAt > new Date()) &&
      assignment.planCode.startsWith("group-online-coaching-"),
    ).map((assignment) => ({
      id: assignment.id,
      clientUserId: assignment.clientUserId,
      clientName: assignment.clientName,
      planName: assignment.planName,
      coachUserId: user.id,
    }));
    return <>
      <PageIntro eyebrow="Online group coaching" title="Groups" description="Create groups of up to 20 assigned group-plan clients, then schedule one Google Meet session for everyone in the group." />
      <GroupCoachingManager
        role="coach"
        eligibleAssignments={eligibleAssignments}
        groups={groupRows.map((group) => ({
          id: group.id,
          name: group.name,
          coachUserId: group.coachUserId,
          coachName: user.displayName,
          members: memberRows.filter((member) => member.groupId === group.id).map((member) => ({
            id: member.id,
            clientUserId: member.clientUserId,
            clientName: member.clientName,
            planName: member.planName,
            coachUserId: member.coachUserId ?? group.coachUserId,
          })),
          sessions: groupSessionRows.filter((session) => session.groupId === group.id).map((session) => ({
            id: session.id,
            title: session.title,
            startsAt: session.startsAt.toISOString(),
            endsAt: session.endsAt.toISOString(),
            status: session.status,
            meetingProvider: session.meetingProvider,
            hasMeetingLink: Boolean(session.providerRoomId),
            rescheduledAt: session.rescheduledAt?.toISOString() ?? null,
          })),
        }))}
      />
    </>;
  }

  if (section === "profile") {
    return (
      <>
        <PageIntro
          eyebrow="Public presence"
          title="Coach profile"
          description="Manage the profile clients see after certification or an admin waiver and activation are complete."
        />
        <Panel>
          <CoachProfileForm
            profile={{
              yearsExperience: profile.yearsExperience,
              languages: profile.languages,
              coachingModes: profile.coachingModes,
              locationLabel: profile.locationLabel,
              acceptingClients: profile.acceptingClients,
              active: profileActive,
              specialties: specialties.map(({ specialty }) => specialty),
            }}
          />
        </Panel>
      </>
    );
  }

  if (section === "settings") {
    return (
      <>
        <PageIntro
          eyebrow="Account"
          title="Settings"
          description="Manage your account details and profile photo."
        />
        <section className={styles.dashboardTwoColumn}>
          <Panel>
            <ProfilePhotoForm
              currentPhotoUrl={profilePhotoUrl}
              displayName={user.displayName}
            />
          </Panel>
          <Panel>
            <PanelHeader title="Account details" />
            <p>
              Signed in as <strong>{user.displayName}</strong> (@{user.username}).
              Use Activate profile to manage availability and location.
            </p>
          </Panel>
        </section>
      </>
    );
  }

  const nextSession = serviceAccessActive ? sessions.find(
    (row) => row.status === "scheduled" && row.startsAt > new Date(),
  ) : undefined;
  return (
    <>
      <PageIntro
        eyebrow="Coach workspace"
        title={`Welcome, ${user.displayName}.`}
        description="Your coaching activity, verified qualifications, availability, and activation status in one place."
        action={
          <PrimaryLink
            href={
              !certificationVerified
                ? "/coach/certification"
                : !profileActive
                  ? "/coach/activation"
                  : "/coach/profile"
            }
          >
            {!certificationVerified
              ? "Verify qualifications"
              : !profileActive
                ? "Activate profile"
                : "Complete profile"}
          </PrimaryLink>
        }
      />
      <Panel className={styles.clientOverviewPanel}>
        <PanelHeader
          title="Profile overview"
          description="Your registration details"
        />
        <div className={styles.clientOverviewDetails}>
          <div>
            <span>Username</span>
            <strong>@{user.username}</strong>
          </div>
          <div>
            <span>Email address</span>
            <strong>{user.email ?? "Not provided"}</strong>
          </div>
          <div>
            <span>Mobile number</span>
            <strong>{user.phone ?? "Not provided"}</strong>
          </div>
        </div>
      </Panel>
      <section className={styles.statGrid}>
        <StatCard
          label="Active clients"
          value={serviceAccessActive ? String(activeAssignments.length) : "Locked"}
          detail={serviceAccessActive ? "Currently assigned" : "Reactivate to view clients"}
          icon={UsersRound}
        />
        <StatCard
          label="Sessions"
          value={serviceAccessActive ? String(sessions.length) : "Locked"}
          detail={
            !serviceAccessActive
              ? "Reactivate to manage sessions"
              : nextSession
              ? nextSession.startsAt.toLocaleDateString()
              : "None upcoming"
          }
          icon={CalendarCheck2}
          tone="black"
        />
        <StatCard
          label="Profile Activation Status"
          value={profileActive ? "Active" : "Inactive"}
          detail={
            profileActive
              ? `Valid until ${profile.activationExpiresAt?.toLocaleDateString(
                  "en-IN",
                )}`
              : certificationVerified
                ? "Activation required or expired"
                : "Certification verification required"
          }
          icon={ShieldCheck}
          tone={profileActive ? "green" : "orange"}
          valueTone={profileActive ? "success" : "danger"}
        />
      </section>
      <section className={styles.dashboardTwoColumn}>
        <Panel>
          <PanelHeader
            title="Availability"
            href="/coach/activation"
            linkLabel="Edit availability"
          />
          {profile.availableDays.length === 0 ||
          profile.availableTimeSlots.length === 0 ? (
            <Empty text="Add your available days, time slots, state, city, and district in Activate profile." />
          ) : (
            <div className={styles.overviewDetails}>
              <p>
                <strong>Days</strong>
                {profile.availableDays
                  .map(
                    (day) =>
                      coachAvailabilityDayLabels[
                        day as CoachAvailabilityDay
                      ] ?? day,
                  )
                  .join(", ")}
              </p>
              <p>
                <strong>Time slots</strong>
                {profile.availableTimeSlots
                  .map(
                    (slot) =>
                      coachAvailabilityTimeSlotLabels[
                        slot as CoachAvailabilityTimeSlot
                      ] ?? slot,
                  )
                  .join(", ")}
              </p>
              <p>
                <strong>Location</strong>
                {[
                  profile.locationDistrict,
                  profile.locationCity,
                  profile.locationState,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title="Verified qualifications"
            href="/coach/certification"
            linkLabel="Manage certificates"
          />
          {approvedCertifications.length === 0 ? (
            <Empty text="Only administrator-accepted certificates appear here." />
          ) : (
            <div className={styles.overviewQualificationList}>
              {approvedCertifications.map((certification) => (
                <p key={certification.id}>
                  {coachQualificationDisplayName(
                    certification.qualificationType as CoachQualificationType,
                    certification.qualificationTitle,
                  )}
                </p>
              ))}
            </div>
          )}
        </Panel>
      </section>
      <Panel>
        <PanelHeader title="Getting started" />
        {!certificationVerified ? (
          profile.approvalStatus === "submitted" ? (
            <p>Your certifications are waiting for admin verification.</p>
          ) : profile.approvalStatus === "rejected" ? (
            <p>
              Review the administrator&apos;s reason in Coach certification,
              correct the required document, and resubmit the group.
            </p>
          ) : (
            <p>
              Add an eligible qualification and certificate in Coach
              certification.
            </p>
          )
        ) : !profileActive ? (
          <p>
            Your qualifications are verified. Choose or renew a coach
            activation plan in Activate profile.
          </p>
        ) : (
          <p>
            Your coach profile is active. Complete your public profile and
            enable accepting clients when you are ready.
          </p>
        )}
      </Panel>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className={styles.emptyCompact}>
      <ShieldCheck size={22} />
      <div>
        <h3>Nothing here yet</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
