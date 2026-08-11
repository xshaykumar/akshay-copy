import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assessmentReports,
  assessments,
  coachAssignments,
  coachingSessions,
  clientProfiles,
  planPurchases,
  plans,
  users,
} from "@/db/schema";
import {
  assessmentGenderLabels,
  assessmentGoalLabels,
  preCoachingResponsesSchema,
} from "@/lib/assessments/pre-coaching";
import { requirePageRole } from "@/lib/auth/session";
import { formatClientPreferredSlot } from "@/lib/assignments/client-availability";
import { coachAvailabilityDayLabels, type CoachAvailabilityDay } from "@/lib/coaches/activation";
import { coachHasCurrentServiceAccess } from "@/lib/coaches/service-access";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";
import { formatPlanDuration } from "@/lib/plans/duration";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";
import {
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/portal/PortalPrimitives";
import { PageIntro } from "@/components/portal/PortalShell";
import { SessionCard } from "@/components/portal/SessionManager";
import styles from "@/components/portal/portal.module.css";

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AssignedClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const coach = await requirePageRole("coach");
  if (!(await coachHasCurrentServiceAccess(coach.id))) {
    redirect("/coach/activation?reason=service-access-expired");
  }
  await reconcileDueServiceCycles();
  const { clientId: clientIdValue } = await params;
  const parsedClientId = z.uuid().safeParse(clientIdValue);
  if (!parsedClientId.success) notFound();
  const clientId = parsedClientId.data;
  const db = getDb();

  const [assignment] = await db
    .select({
      id: coachAssignments.id,
      assignedAt: coachAssignments.assignedAt,
      clientAvailableDays: coachAssignments.clientAvailableDays,
      clientPreferredTime: coachAssignments.clientPreferredTime,
      clientName: users.displayName,
      clientUsername: users.username,
      planName: plans.name,
      planMode: plans.coachingMode,
      planDurationDays: plans.durationDays,
      planExpiresAt: planPurchases.expiresAt,
      locationState: clientProfiles.locationState,
      locationCity: clientProfiles.locationCity,
      locationDistrict: clientProfiles.locationDistrict,
    })
    .from(coachAssignments)
    .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
    .innerJoin(
      clientProfiles,
      eq(clientProfiles.userId, coachAssignments.clientUserId),
    )
    .innerJoin(
      planPurchases,
      eq(planPurchases.id, coachAssignments.purchaseId),
    )
    .innerJoin(plans, eq(plans.id, planPurchases.planId))
    .where(
      and(
        eq(coachAssignments.clientUserId, clientId),
        eq(coachAssignments.coachUserId, coach.id),
        eq(coachAssignments.status, "assigned"),
      ),
    )
    .limit(1);
  if (!assignment) notFound();

  const [assessment, clientPhotoUrl, sessions] = await Promise.all([
    db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.clientUserId, clientId),
          inArray(assessments.status, ["submitted", "reviewed"]),
        ),
      )
      .orderBy(desc(assessments.version))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getProfilePhotoUrl(clientId),
    db
      .select()
      .from(coachingSessions)
      .where(eq(coachingSessions.assignmentId, assignment.id))
      .orderBy(desc(coachingSessions.startsAt)),
  ]);

  const parsedAssessment = assessment
    ? preCoachingResponsesSchema.safeParse(assessment.responses)
    : null;
  const responses = parsedAssessment?.success ? parsedAssessment.data : null;
  const reportRows = assessment
    ? await db
        .select()
        .from(assessmentReports)
        .where(eq(assessmentReports.assessmentId, assessment.id))
    : [];
  const reportStorage = createAdminClient().storage.from("assessment-reports");
  const reports = await Promise.all(
    reportRows.map(async (report) => {
      const { data } = await reportStorage.createSignedUrl(
        report.storagePath,
        10 * 60,
      );
      return { ...report, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <>
      <Link className={styles.backLink} href="/coach/clients">
        <ArrowLeft size={15} aria-hidden="true" /> Back to my clients
      </Link>
      <PageIntro
        eyebrow="Assigned client"
        title={assignment.clientName}
        description="Private client information is visible only while this client is assigned to your coach account."
      />

      <section className={styles.clientProfileHero}>
        <div
          className={`${styles.clientProfileAvatar} ${clientPhotoUrl ? styles.clientProfileAvatarPhoto : ""}`}
          style={
            clientPhotoUrl
              ? { backgroundImage: `url(${clientPhotoUrl})` }
              : undefined
          }
          aria-hidden="true"
        >
          {clientPhotoUrl
            ? null
            : assignment.clientName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
        </div>
        <div>
          <span className={styles.eyebrow}>Client overview</span>
          <h2>{assignment.planName}</h2>
          <p>
            @{assignment.clientUsername} · {assignment.planMode} coaching ·{" "}
            {formatPlanDuration(assignment.planDurationDays)}
          </p>
          <p>
            {[
              assignment.locationCity,
              assignment.locationDistrict,
              assignment.locationState,
            ]
              .filter(Boolean)
              .join(", ") || "Location not provided"}
          </p>
          <p>
            Availability: {assignment.clientAvailableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ") || "days not selected"} · {formatClientPreferredSlot(assignment.clientPreferredTime)}
          </p>
        </div>
        <div className={styles.clientProfileStatus}>
          <StatusBadge tone="success">Assigned</StatusBadge>
          <span>
            Started {assignment.assignedAt?.toLocaleDateString("en-IN") ?? "—"}
          </span>
          <span>
            Plan ends {assignment.planExpiresAt?.toLocaleDateString("en-IN") ?? "—"}
          </span>
        </div>
      </section>

      <Panel>
          <PanelHeader
            title="Health assessment"
            description={
              assessment?.submittedAt
                ? `Submitted ${assessment.submittedAt.toLocaleDateString("en-IN")}`
                : "No submitted assessment"
            }
          />
          {!responses ? (
            <div className={styles.emptyCompact}>
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h3>Assessment unavailable</h3>
                <p>The client has not submitted a valid health assessment.</p>
              </div>
            </div>
          ) : (
            <div className={styles.assessmentOverview}>
              <section>
                <h3>Personal information</h3>
                <dl>
                  <div><dt>Age</dt><dd>{responses.age}</dd></div>
                  <div><dt>Gender</dt><dd>{assessmentGenderLabels[responses.gender]}</dd></div>
                  <div><dt>Height</dt><dd>{responses.heightCm} cm</dd></div>
                  <div><dt>Weight</dt><dd>{responses.weightKg} kg</dd></div>
                </dl>
              </section>
              <section>
                <h3>Goals and experience</h3>
                <div className={styles.assessmentTags}>
                  {responses.goals.map((goal) => (
                    <span key={goal}>{assessmentGoalLabels[goal]}</span>
                  ))}
                </div>
                {responses.otherGoal ? <p>{responses.otherGoal}</p> : null}
                <dl><div><dt>Experience</dt><dd>{label(responses.experience)}</dd></div></dl>
              </section>
              <section>
                <h3>Medical and dietary context</h3>
                <dl>
                  <div><dt>Medical condition</dt><dd>{responses.hasMedicalCondition ? "Yes" : "No"}</dd></div>
                  <div><dt>Diet</dt><dd>{label(responses.dietaryPreference)}</dd></div>
                </dl>
                {responses.medicalDetails ? <p>{responses.medicalDetails}</p> : null}
                {reports.length > 0 ? (
                  <div className={styles.assessmentReports}>
                    {reports.map((report) =>
                      report.url ? (
                        <a key={report.id} href={report.url} target="_blank" rel="noreferrer">
                          <FileText size={14} aria-hidden="true" /> {report.originalFilename}
                        </a>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </section>
              <section>
                <h3>Training availability</h3>
                <dl>
                  <div><dt>Days per week</dt><dd>{responses.trainingDaysPerWeek}</dd></div>
                  <div><dt>Preferred time</dt><dd>{label(responses.preferredTrainingTime)}</dd></div>
                </dl>
              </section>
              {responses.additionalInformation ? (
                <section>
                  <h3>Additional information</h3>
                  <p>{responses.additionalInformation}</p>
                </section>
              ) : null}
            </div>
          )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Client sessions"
          description={`${sessions.length} scheduled or completed record${sessions.length === 1 ? "" : "s"}`}
        />
        {sessions.length === 0 ? (
          <p>No session has been scheduled for this client.</p>
        ) : (
          <div className={styles.sessionList}>
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                role="coach"
                counterpartyName={assignment.clientName}
                session={{
                  id: session.id,
                  title: session.title,
                  mode: session.mode,
                  startsAt: session.startsAt.toISOString(),
                  endsAt: session.endsAt.toISOString(),
                  status: session.status,
                  meetingProvider: session.meetingProvider,
                  hasMeetingLink: Boolean(session.providerRoomId),
                  rescheduledAt: session.rescheduledAt?.toISOString() ?? null,
                  cancellationReason: session.cancellationReason,
                }}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
