import { and, asc, count, desc, eq, gt, inArray, isNotNull, like } from "drizzle-orm";
import Link from "next/link";
import {
  FileCheck2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { getDb } from "@/db";
import {
  assessments,
  clientProfiles,
  coachAssignments,
  coachCertifications,
  coachProfiles,
  consultations,
  coachingGroupMembers,
  coachingGroups,
  paymentOrders,
  planPurchases,
  plans,
  refunds,
  users,
} from "@/db/schema";
import {
  coachQualificationDisplayName,
  type CoachQualificationType,
} from "@/lib/coaches/certifications";
import {
  hasCoachAvailability,
  isCoachProfileActive,
} from "@/lib/coaches/activation";
import { hasClientAvailability } from "@/lib/assessments/pre-coaching";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageIntro } from "./PortalShell";
import {
  Panel,
  PanelHeader,
  StatCard,
  StatusBadge,
} from "./PortalPrimitives";
import { CoachVerificationDecision } from "./CertificationActions";
import { ActionButton } from "./PortalActions";
import { GroupCoachingManager } from "./GroupCoachingManager";
import styles from "./portal.module.css";

export async function AdminPortalPage({
  section = "overview",
  filters = {},
}: {
  section?: string;
  filters?: {
    coachStatus?: string;
    clientPayment?: string;
  };
}) {
  const db = getDb();
  const [[userCount], [coachCount]] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db
        .select({ value: count() })
        .from(coachProfiles)
        .where(isNotNull(coachProfiles.approvedAt)),
    ]);
  const totals = {
    users: userCount.value,
    coaches: coachCount.value,
  };

  if (section === "groups") {
    const now = new Date();
    const [groupRows, memberRows, assignmentRows] = await Promise.all([
      db.select({
        id: coachingGroups.id,
        name: coachingGroups.name,
        coachUserId: coachingGroups.coachUserId,
        coachName: users.displayName,
        createdAt: coachingGroups.createdAt,
      }).from(coachingGroups)
        .innerJoin(users, eq(users.id, coachingGroups.coachUserId))
        .orderBy(asc(coachingGroups.createdAt)),
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
        .innerJoin(plans, eq(plans.id, planPurchases.planId)),
      db.select({
        id: coachAssignments.id,
        clientUserId: coachAssignments.clientUserId,
        clientName: users.displayName,
        planName: plans.name,
        coachUserId: coachAssignments.coachUserId,
      }).from(coachAssignments)
        .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
        .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(and(
          eq(coachAssignments.status, "assigned"),
          eq(planPurchases.status, "active"),
          gt(planPurchases.expiresAt, now),
          like(plans.code, "group-online-coaching-%"),
        )),
    ]);
    return <>
      <PageIntro eyebrow="Online group coaching" title="Groups" description="Review every coach group and manage membership. Sessions remain under the assigned coach's control." />
      <GroupCoachingManager
        role="admin"
        eligibleAssignments={assignmentRows.map((assignment) => ({ ...assignment, coachUserId: assignment.coachUserId ?? "" }))}
        groups={groupRows.map((group) => ({
          id: group.id,
          name: group.name,
          coachUserId: group.coachUserId,
          coachName: group.coachName,
          members: memberRows.filter((member) => member.groupId === group.id).map((member) => ({
            id: member.id,
            clientUserId: member.clientUserId,
            clientName: member.clientName,
            planName: member.planName,
            coachUserId: member.coachUserId ?? group.coachUserId,
          })),
          sessions: [],
        }))}
      />
    </>;
  }

  if (section === "consultations") {
    const rows = await db
      .select({
        id: consultations.id,
        contactName: consultations.contactName,
        contactPhone: consultations.contactPhone,
        goal: consultations.goalCategory,
        submittedAt: consultations.createdAt,
      })
      .from(consultations)
      .orderBy(desc(consultations.createdAt));
    return (
      <>
        <PageIntro eyebrow="Consultation enquiries" title="Consultations" description="Free consultation requests submitted through the public website." />
        <Panel>
          <PanelHeader title="Submitted requests" description={`${rows.length} total`} />
          {rows.length === 0 ? <Empty text="No consultation request has been submitted yet." /> : (
            <Table headings={["Name", "Mobile number", "Goal", "Submission date"]}>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.contactName}</strong></td>
                  <td><a className={styles.textLink} href={`tel:${row.contactPhone}`}>{row.contactPhone}</a></td>
                  <td className={styles.consultationGoal}>{row.goal}</td>
                  <td>{row.submittedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </>
    );
  }

  if (section === "refunds") {
    const rows = await db
      .select({
        id: refunds.id,
        status: refunds.status,
        reasonCode: refunds.reasonCode,
        contactEmail: refunds.contactEmail,
        contactPhone: refunds.contactPhone,
        requestedAt: refunds.createdAt,
        clientName: users.displayName,
        planName: plans.name,
        purchasedAt: planPurchases.purchasedAt,
        paymentCreatedAt: paymentOrders.createdAt,
        amountPaise: refunds.amountPaise,
      })
      .from(refunds)
      .innerJoin(paymentOrders, eq(paymentOrders.id, refunds.paymentOrderId))
      .innerJoin(planPurchases, eq(planPurchases.id, paymentOrders.purchaseId))
      .innerJoin(plans, eq(plans.id, planPurchases.planId))
      .innerJoin(users, eq(users.id, planPurchases.clientUserId))
      .orderBy(desc(refunds.createdAt));
    const pendingCount = rows.filter((row) => row.status === "requested").length;
    return (
      <>
        <PageIntro
          eyebrow="Payment operations"
          title="Refund requests"
          description="Client-submitted refund requests awaiting administrator review. No refund is issued automatically."
        />
        <Panel>
          <PanelHeader
            title="Submitted refund requests"
            description={`${pendingCount} awaiting review · ${rows.length} total`}
          />
          {rows.length === 0 ? (
            <Empty text="No client has submitted a refund request." />
          ) : (
            <Table
              headings={[
                "Client",
                "Plan",
                "Buy date",
                "Mobile number",
                "Email",
                "Amount",
                "Requested",
                "Status",
                "Action",
              ]}
            >
              {rows.map((row) => {
                const buyDate = row.purchasedAt ?? row.paymentCreatedAt;
                return (
                  <tr key={row.id}>
                    <td><strong>{row.clientName}</strong></td>
                    <td>{row.planName}</td>
                    <td>{buyDate.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>
                      {row.contactPhone ? (
                        <a className={styles.textLink} href={`tel:${row.contactPhone}`}>
                          {row.contactPhone}
                        </a>
                      ) : "Unavailable"}
                    </td>
                    <td>
                      {row.contactEmail ? (
                        <a className={styles.textLink} href={`mailto:${row.contactEmail}`}>
                          {row.contactEmail}
                        </a>
                      ) : "Unavailable"}
                    </td>
                    <td>₹{(row.amountPaise / 100).toLocaleString("en-IN")}</td>
                    <td>{row.requestedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>
                      <StatusBadge
                        tone={row.status === "completed" ? "success" : row.status === "failed" ? "danger" : "warning"}
                      >
                        {row.status}
                      </StatusBadge>
                    </td>
                    <td>
                      {row.status === "requested" ? (
                        <ActionButton
                          url={`/api/admin/refunds/${row.id}/approve`}
                          tone="secondary"
                        >
                          Approve refund
                        </ActionButton>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      </>
    );
  }

  if (section === "verification") {
    const pending = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        username: users.username,
        submittedAt: coachProfiles.certificationSubmittedAt,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(eq(coachProfiles.approvalStatus, "submitted"))
      .orderBy(desc(coachProfiles.certificationSubmittedAt));
    const pendingIds = pending.map((coach) => coach.userId);
    const certificates = pendingIds.length > 0
      ? await db
          .select()
          .from(coachCertifications)
          .where(
            and(
              inArray(coachCertifications.coachUserId, pendingIds),
              eq(coachCertifications.verificationStatus, "submitted"),
            ),
          )
      : [];
    const storage = createAdminClient().storage.from("coach-certificates");
    const certificateRows = await Promise.all(certificates.map(async (certificate) => {
      const { data } = await storage.createSignedUrl(certificate.storagePath, 10 * 60);
      return { ...certificate, url: data?.signedUrl ?? null };
    }));
    return (
      <>
        <PageIntro eyebrow="Credential review" title="Coach verification" description="Review all certificates in each submission and accept or reject the submitted group together." />
        <Panel>
          <PanelHeader title="Pending certification applications" description={`${pending.length} awaiting review`} />
          {pending.length === 0 ? <Empty text="No certification application is waiting for review." /> : pending.map((coach) => {
            const coachCertificates = certificateRows.filter((certificate) => certificate.coachUserId === coach.userId);
            return (
              <article className={styles.verificationCard} key={coach.userId}>
                <div>
                  <h2>{coach.displayName}</h2>
                  <p>@{coach.username}{coach.submittedAt ? ` · submitted ${coach.submittedAt.toLocaleString()}` : ""}</p>
                  <div className={styles.qualificationList}>
                    {coachCertificates.map((certificate) => {
                      const qualification = certificate.qualificationType as CoachQualificationType;
                      return <article key={certificate.id}><span><FileCheck2 size={17} aria-hidden="true" /></span><div><h3>{coachQualificationDisplayName(qualification, certificate.qualificationTitle)}</h3><p>{certificate.originalFilename} · {(certificate.sizeBytes / 1024).toFixed(0)} KB</p></div>{certificate.url ? <a className={styles.textLink} href={certificate.url} target="_blank" rel="noreferrer">Open certificate</a> : <span>Unavailable</span>}</article>;
                    })}
                  </div>
                </div>
                <CoachVerificationDecision coachUserId={coach.userId} />
              </article>
            );
          })}
        </Panel>
      </>
    );
  }

  if (section === "coaches") {
    const [profileRows, assignedRows] = await Promise.all([
      db
        .select({
          userId: users.id,
          displayName: users.displayName,
          username: users.username,
          accountStatus: users.status,
          approvalStatus: coachProfiles.approvalStatus,
          approvedAt: coachProfiles.approvedAt,
          certificationWaivedAt: coachProfiles.certificationWaivedAt,
          activationExpiresAt: coachProfiles.activationExpiresAt,
          availableDays: coachProfiles.availableDays,
          availableTimeSlots: coachProfiles.availableTimeSlots,
          acceptingClients: coachProfiles.acceptingClients,
        })
        .from(coachProfiles)
        .innerJoin(users, eq(users.id, coachProfiles.userId))
        .orderBy(desc(coachProfiles.updatedAt)),
      db
        .select({
          coachUserId: coachAssignments.coachUserId,
          value: count(),
        })
        .from(coachAssignments)
        .where(eq(coachAssignments.status, "assigned"))
        .groupBy(coachAssignments.coachUserId),
    ]);
    const assignedCounts = new Map(
      assignedRows.flatMap((row) =>
        row.coachUserId ? [[row.coachUserId, row.value] as const] : [],
      ),
    );
    const allRows = profileRows.map((row) => ({
      ...row,
      assignedClientCount: assignedCounts.get(row.userId) ?? 0,
    }));
    const now = new Date();
    const coachStatus = ["active", "inactive", "banned"].includes(
      filters.coachStatus ?? "",
    )
      ? filters.coachStatus
      : "all";
    const rows = allRows.filter((row) => {
      const banned = row.accountStatus === "suspended";
      const active =
        row.accountStatus === "active" && isCoachProfileActive(row, now);
      if (coachStatus === "active") return active;
      if (coachStatus === "inactive") return !active && !banned;
      if (coachStatus === "banned") return banned;
      return true;
    });
    return (
      <>
        <PageIntro eyebrow="Coach operations" title="Coaches" description="View every coach, grant a 30-day activation after availability is saved, and ban only coaches without assigned clients. A manual activation also waives the certification gate." />
        <div className={styles.infoBanner}>
          <ShieldCheck size={19} aria-hidden="true" />
          <p>
            <strong>Manual activation waives both payment and certification.</strong>{" "}
            The coach still needs saved availability, an accessible account,
            a current activation period, and Accepting clients enabled before
            appearing to clients.
          </p>
        </div>
        <Panel>
          <PanelHeader title="Coach accounts" description={`${rows.length} shown · ${allRows.length} total`} />
          <form className={styles.filterBar} method="get">
            <label>
              <span className="sr-only">Coach status</span>
              <select
                className={styles.filterButton}
                name="coachStatus"
                defaultValue={coachStatus}
              >
                <option value="all">All coaches</option>
                <option value="active">Active coaches</option>
                <option value="inactive">Inactive coaches</option>
                <option value="banned">Banned coaches</option>
              </select>
            </label>
            <button className={styles.primaryButton} type="submit">
              Apply filter
            </button>
            <Link className={styles.filterReset} href="/admin/coaches">
              Reset
            </Link>
          </form>
          {rows.length === 0 ? <Empty text="No coach matches this filter." /> : (
            <Table headings={["Coach", "Account", "Certification", "Availability", "Assigned clients", "Accepting clients", "30-day fee period", "Action"]}>
              {rows.map((row) => {
                const availabilityComplete = hasCoachAvailability(row);
                const activationCurrent = Boolean(
                  row.activationExpiresAt &&
                    row.activationExpiresAt > now,
                );
                return (
                <tr key={row.userId}>
                  <td>
                    <Link className={styles.accountProfileLink} href={`/admin/coaches/${row.userId}`}>
                      <strong>{row.displayName}</strong>
                      <small>@{row.username}</small>
                    </Link>
                  </td>
                  <td><StatusBadge tone={row.accountStatus === "active" ? "success" : row.accountStatus === "suspended" ? "danger" : "neutral"}>{row.accountStatus === "suspended" ? "Banned" : row.accountStatus}</StatusBadge></td>
                  <td><StatusBadge tone={row.approvalStatus === "approved" || row.certificationWaivedAt ? "success" : row.approvalStatus === "rejected" ? "danger" : row.approvalStatus === "submitted" ? "warning" : "neutral"}>{row.certificationWaivedAt ? "Waived by admin" : row.approvalStatus}</StatusBadge></td>
                  <td><StatusBadge tone={availabilityComplete ? "success" : "warning"}>{availabilityComplete ? "Complete" : "Missing"}</StatusBadge></td>
                  <td>{row.assignedClientCount}</td>
                  <td>
                    {row.acceptingClients ? (
                      "Yes"
                    ) : (
                      <>
                        No<br />
                        <small>Coach must enable this in Profile</small>
                      </>
                    )}
                  </td>
                  <td><StatusBadge tone={activationCurrent ? "success" : "danger"}>{activationCurrent ? `Until ${row.activationExpiresAt?.toLocaleDateString("en-IN")}` : "Inactive"}</StatusBadge></td>
                  <td>
                    {row.accountStatus === "suspended" ? (
                      "Banned"
                    ) : row.accountStatus === "closed" ? (
                      "Closed"
                    ) : (
                      <div className={styles.adminActions}>
                        {!activationCurrent ? (
                          availabilityComplete ? (
                            <ActionButton
                              url={`/api/admin/coaches/${row.userId}/activate`}
                              confirmMessage={`Activate ${row.displayName} for 30 days without requiring the ₹159 fee?`}
                            >
                              Activate 30 days
                            </ActionButton>
                          ) : (
                            <small>Availability required to activate</small>
                          )
                        ) : null}
                        {row.assignedClientCount > 0 ? (
                          <small>Cannot ban while clients are assigned</small>
                        ) : (
                          <ActionButton
                            url={`/api/admin/coaches/${row.userId}/ban`}
                            tone="secondary"
                            confirmMessage={`Ban ${row.displayName}? They will immediately lose platform access and stop accepting new clients.`}
                          >
                            Ban coach
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      </>
    );
  }

  if (section === "users") {
    const [allClients, paidPurchases, assessmentRows] = await Promise.all([
      db
        .select({
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          contactPhone: users.contactPhone,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(clientProfiles)
        .innerJoin(users, eq(users.id, clientProfiles.userId))
        .orderBy(desc(users.createdAt)),
      db
        .select({ clientUserId: planPurchases.clientUserId })
        .from(planPurchases)
        .where(inArray(planPurchases.status, ["paid", "active"])),
      db
        .select({
          clientUserId: assessments.clientUserId,
          responses: assessments.responses,
          version: assessments.version,
        })
        .from(assessments)
        .orderBy(desc(assessments.version)),
    ]);
    const paidClientIds = new Set(
      paidPurchases.map((purchase) => purchase.clientUserId),
    );
    const latestAvailability = new Map<string, boolean>();
    for (const assessment of assessmentRows) {
      if (!latestAvailability.has(assessment.clientUserId)) {
        latestAvailability.set(
          assessment.clientUserId,
          hasClientAvailability(assessment.responses),
        );
      }
    }
    const clientPayment = ["paid", "unpaid"].includes(
      filters.clientPayment ?? "",
    )
      ? filters.clientPayment
      : "all";
    const rows = allClients.filter((client) => {
      const paid = paidClientIds.has(client.id);
      if (clientPayment === "paid") return paid;
      if (clientPayment === "unpaid") return !paid;
      return true;
    });
    return (
      <>
        <PageIntro eyebrow="Client operations" title="Clients" description="View every client, filter by payment, and control account access independently of plan payment." />
        <Panel>
          <PanelHeader title="Client accounts" description={`${rows.length} shown · ${allClients.length} total`} />
          <form className={styles.filterBar} method="get">
            <label>
              <span className="sr-only">Client payment status</span>
              <select
                className={styles.filterButton}
                name="clientPayment"
                defaultValue={clientPayment}
              >
                <option value="all">All clients</option>
                <option value="paid">Paid clients</option>
                <option value="unpaid">Unpaid clients</option>
              </select>
            </label>
            <button className={styles.primaryButton} type="submit">
              Apply filter
            </button>
            <Link className={styles.filterReset} href="/admin/users">
              Reset
            </Link>
          </form>
          {rows.length === 0 ? <Empty text="No client matches this filter." /> : (
            <Table headings={["Client", "Mobile", "Payment", "Availability", "Account", "Created", "Action"]}>
              {rows.map((row) => {
                const paid = paidClientIds.has(row.id);
                const availabilityComplete =
                  latestAvailability.get(row.id) ?? false;
                return (
                  <tr key={row.id}>
                    <td>
                      <Link className={styles.accountProfileLink} href={`/admin/clients/${row.id}`}>
                        <strong>{row.displayName}</strong>
                        <small>@{row.username}</small>
                      </Link>
                    </td>
                    <td>{row.contactPhone ?? "Not provided"}</td>
                    <td><StatusBadge tone={paid ? "success" : "neutral"}>{paid ? "Paid" : "Unpaid"}</StatusBadge></td>
                    <td><StatusBadge tone={availabilityComplete ? "success" : "warning"}>{availabilityComplete ? "Complete" : "Missing"}</StatusBadge></td>
                    <td><StatusBadge tone={row.status === "active" ? "success" : row.status === "suspended" ? "danger" : "neutral"}>{row.status === "suspended" ? "Inactive" : row.status}</StatusBadge></td>
                    <td>{row.createdAt.toLocaleDateString()}</td>
                    <td>
                      {row.status === "closed" ? (
                        "Closed"
                      ) : row.status === "active" ? (
                        <ActionButton
                          url={`/api/admin/clients/${row.id}/status`}
                          body={{ decision: "deactivate" }}
                          tone="secondary"
                          confirmMessage={`Deactivate ${row.displayName}? They will lose platform access until an administrator activates the account again.`}
                        >
                          Deactivate
                        </ActionButton>
                      ) : availabilityComplete ? (
                        <ActionButton
                          url={`/api/admin/clients/${row.id}/status`}
                          body={{ decision: "activate" }}
                        >
                          Activate
                        </ActionButton>
                      ) : (
                        "Availability required"
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      </>
    );
  }

  if (section === "settings") {
    return <><PageIntro eyebrow="Security" title="Admin settings" description="MFA is mandatory for every admin API and page request." /><Panel><p>Administrator access is provisioned separately from public registration using the email configured in <code>ADMIN_EMAIL</code>. Secrets stay server-only.</p></Panel></>;
  }

  return (
    <>
      <PageIntro eyebrow="Platform command centre" title="Admin dashboard" description="A live view of registered accounts and platform operations." />
      <Summary totals={totals} />
    </>
  );
}

function Summary({ totals }: { totals: { users: number; coaches: number } }) {
  return <section className={styles.statGrid}>
    <StatCard label="Accounts" value={String(totals.users)} detail="Current environment" icon={UsersRound} />
    <StatCard label="Approved coaches" value={String(totals.coaches)} detail="Eligible profiles" icon={UserRoundCheck} tone="black" />
  </section>;
}

function Empty({ text }: { text: string }) {
  return <div className={styles.emptyCompact}><ShieldCheck size={22} /><div><h3>Nothing here yet</h3><p>{text}</p></div></div>;
}

function Table({ headings, children }: { headings: string[]; children: React.ReactNode }) {
  return <div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
