"use client";

import { CalendarPlus, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { SessionCard } from "./SessionManager";
import styles from "./portal.module.css";

type AssignmentOption = {
  id: string;
  clientUserId: string;
  clientName: string;
  planName: string;
  coachUserId: string;
};

type GroupMember = AssignmentOption;

type GroupSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  meetingProvider: string;
  hasMeetingLink: boolean;
  rescheduledAt?: string | null;
};

export type CoachingGroupView = {
  id: string;
  name: string;
  coachUserId: string;
  coachName: string;
  members: GroupMember[];
  sessions: GroupSession[];
};

async function apiRequest(url: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? "The request could not be completed.");
}

export function GroupCoachingManager({
  groups,
  eligibleAssignments,
  role,
}: {
  groups: CoachingGroupView[];
  eligibleAssignments: AssignmentOption[];
  role: "coach" | "admin";
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const assignedMemberships = useMemo(
    () => new Set(groups.flatMap((group) => group.members.map((member) => member.id))),
    [groups],
  );

  async function run(action: () => Promise<void>, success: string) {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(
      () => apiRequest("/api/coaching-groups", "POST", { name: data.get("name") }),
      "Group created.",
    ).then(() => form.reset());
  }

  function schedule(groupId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startsAt = new Date(String(data.get("startsAt")));
    const minutes = Number(data.get("durationMinutes"));
    if (Number.isNaN(startsAt.getTime()) || !Number.isFinite(minutes)) {
      setMessage("Choose a valid date, time and duration.");
      return;
    }
    void run(() => apiRequest(`/api/coaching-groups/${groupId}/sessions`, "POST", {
      title: data.get("title"),
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + minutes * 60_000).toISOString(),
      meetingUrl: data.get("meetingUrl"),
    }), "Group session scheduled and sent to eligible members.");
  }

  return (
    <div className={styles.stack}>
      {role === "coach" ? (
        <form className={styles.formGrid} onSubmit={createGroup}>
          <label className={styles.fieldWide}>
            <span>New group name</span>
            <input name="name" minLength={2} maxLength={80} placeholder="Morning strength group" required />
          </label>
          <button className={styles.primaryButton} type="submit" disabled={working}>
            <UsersRound size={16} aria-hidden="true" /> Create group
          </button>
        </form>
      ) : null}

      {groups.length === 0 ? <p>No coaching groups have been created.</p> : groups.map((group) => {
        const options = eligibleAssignments.filter((assignment) =>
          assignment.coachUserId === group.coachUserId && !assignedMemberships.has(assignment.id),
        );
        return (
          <section className={styles.panel} key={group.id}>
            <div className={styles.panelHeader}>
              <div>
                <h2>{group.name}</h2>
                <p>{group.coachName} · {group.members.length}/20 members</p>
              </div>
            </div>

            <div className={styles.stack}>
              <form className={styles.inlineForm} onSubmit={(event) => {
                event.preventDefault();
                const assignmentId = String(new FormData(event.currentTarget).get("assignmentId"));
                void run(() => apiRequest(`/api/coaching-groups/${group.id}/members`, "POST", { assignmentId }), "Client added to the group.");
              }}>
                <label>
                  <span>Add an assigned group-plan client</span>
                  <select name="assignmentId" required defaultValue="">
                    <option value="" disabled>{options.length ? "Choose a client" : "No eligible clients available"}</option>
                    {options.map((option) => <option key={option.id} value={option.id}>{option.clientName} · {option.planName}</option>)}
                  </select>
                </label>
                <button className={styles.secondaryButton} type="submit" disabled={working || options.length === 0}>
                  <UserPlus size={15} aria-hidden="true" /> Add
                </button>
              </form>

              {group.members.length ? (
                <div className={styles.compactList}>
                  {group.members.map((member) => (
                    <div className={styles.listRow} key={member.id}>
                      <div><strong>{member.clientName}</strong><p>{member.planName}</p></div>
                      <button className={styles.secondaryButton} type="button" disabled={working} onClick={() => void run(
                        () => apiRequest(`/api/coaching-groups/${group.id}/members`, "DELETE", { assignmentId: member.id }),
                        "Client removed from the group.",
                      )}><UserMinus size={15} aria-hidden="true" /> Remove</button>
                    </div>
                  ))}
                </div>
              ) : <p>This group has no members yet.</p>}

              {role === "coach" ? (
                <details className={styles.sessionManage}>
                  <summary><CalendarPlus size={15} aria-hidden="true" /> Schedule a group session</summary>
                  <form className={styles.formGrid} onSubmit={(event) => schedule(group.id, event)}>
                    <label><span>Session title</span><input name="title" minLength={2} maxLength={120} required /></label>
                    <label><span>Date and start time</span><input name="startsAt" type="datetime-local" required /></label>
                    <label><span>Duration</span><select name="durationMinutes" defaultValue="60"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label>
                    <label className={styles.fieldWide}><span>Google Meet link</span><input name="meetingUrl" type="url" placeholder="https://meet.google.com/abc-defg-hij" required /></label>
                    <button className={styles.primaryButton} type="submit" disabled={working || group.members.length === 0}>Schedule and send</button>
                  </form>
                </details>
              ) : null}

              {role === "coach" && group.sessions.length ? <div className={styles.sessionList}>{group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  role="coach"
                  session={{ ...session, mode: "online" }}
                  counterpartyName={group.name}
                  updateUrl={`/api/group-sessions/${session.id}`}
                  joinUrl={`/api/group-sessions/${session.id}/join`}
                  accessNote="Access is limited to the assigned coach and currently eligible members of this group."
                />
              ))}</div> : null}
            </div>
          </section>
        );
      })}
      {message ? <p className={styles.formStatus} role="status">{message}</p> : null}
    </div>
  );
}
