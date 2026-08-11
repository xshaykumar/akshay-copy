"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./portal.module.css";

type SessionSummary = {
  id: string;
  title: string;
  mode: string;
  startsAt: string;
  endsAt: string;
  status: string;
  meetingProvider: string;
  hasMeetingLink: boolean;
  rescheduledAt?: string | null;
  cancellationReason?: string | null;
};

type ApiResult = {
  joinUrl?: string;
  error?: { message?: string };
};

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function joinState(session: SessionSummary, now: number) {
  if (session.mode !== "online" || session.status !== "scheduled") {
    return "unavailable" as const;
  }
  const startsAt = new Date(session.startsAt).getTime();
  const endsAt = new Date(session.endsAt).getTime();
  if (now < startsAt - 10 * 60_000) return "upcoming" as const;
  if (now > endsAt + 15 * 60_000) return "ended" as const;
  if (
    session.meetingProvider === "unconfigured" ||
    !session.hasMeetingLink
  ) {
    return "provider_pending" as const;
  }
  return "ready" as const;
}

export function SessionCard({
  session,
  role,
  counterpartyName,
  updateUrl,
  joinUrl,
  accessNote,
}: {
  session: SessionSummary;
  role: "client" | "coach";
  counterpartyName?: string | null;
  updateUrl?: string;
  joinUrl?: string;
  accessNote?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const availability = useMemo(() => joinState(session, now), [session, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function update(body: Record<string, unknown>) {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(updateUrl ?? `/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok) {
        throw new Error(result.error?.message ?? "The session could not be updated.");
      }
      setMessage("Session updated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The session could not be updated.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const startsAt = new Date(String(values.get("startsAt")));
    const durationMinutes = Number(values.get("durationMinutes"));
    if (
      Number.isNaN(startsAt.getTime()) ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      setMessage("Choose a valid start time and duration.");
      return;
    }
    await update({
      action: "reschedule",
      startsAt: startsAt.toISOString(),
      endsAt: new Date(
        startsAt.getTime() + durationMinutes * 60_000,
      ).toISOString(),
    });
  }

  async function saveMeetingLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await update({
      action: "meeting_link",
      meetingUrl: values.get("meetingUrl"),
    });
  }

  async function joinMeeting() {
    if (working || availability !== "ready") return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(joinUrl ?? `/api/sessions/${session.id}/join`);
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok || !result.joinUrl) {
        throw new Error(
          result.error?.message ?? "The meeting room is not available yet.",
        );
      }
      const meetingWindow = window.open(
        result.joinUrl,
        "_blank",
        "noopener,noreferrer",
      );
      if (meetingWindow) meetingWindow.opener = null;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The meeting could not be opened.",
      );
    } finally {
      setWorking(false);
    }
  }

  const startsAt = new Date(session.startsAt);
  const endsAt = new Date(session.endsAt);
  const durationMinutes = Math.round(
    (endsAt.getTime() - startsAt.getTime()) / 60_000,
  );

  return (
    <article className={styles.sessionCard}>
      <div className={styles.sessionDateBlock}>
        <span>{startsAt.toLocaleDateString(undefined, { month: "short" })}</span>
        <strong>{startsAt.getDate()}</strong>
      </div>
      <div className={styles.sessionMain}>
        <div className={styles.sessionHeading}>
          <div>
            <h3>{session.title}</h3>
            <p>
              {startsAt.toLocaleString([], {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" – "}
              {endsAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              {counterpartyName ? ` · ${counterpartyName}` : ""}
            </p>
          </div>
          <span className={styles.sessionStatus}>{session.status}</span>
        </div>
        <div className={styles.sessionMeta}>
          <span><Clock3 size={14} aria-hidden="true" /> {durationMinutes} minutes</span>
          <span><Video size={14} aria-hidden="true" /> {session.mode === "online" ? "Google Meet" : "In person"}</span>
          {session.rescheduledAt ? <span><CalendarClock size={14} aria-hidden="true" /> Rescheduled</span> : null}
        </div>

        {session.status === "scheduled" && session.mode === "online" ? (
          <div className={styles.meetingAccessRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={working || availability !== "ready"}
              onClick={joinMeeting}
            >
              <Video size={15} aria-hidden="true" />
              {availability === "ready"
                ? "Join Google Meet"
                : availability === "provider_pending"
                  ? "Google Meet link needed"
                  : availability === "upcoming"
                    ? "Join opens 10 minutes before"
                    : "Join window closed"}
            </button>
            <small>
              {accessNote ?? "Access is limited to this client and their assigned coach."}
            </small>
          </div>
        ) : null}

        {session.status === "scheduled" && role === "coach" ? (
          <details className={styles.sessionManage}>
            <summary>Manage session</summary>
              {session.mode === "online" ? (
                <form className={styles.sessionMeetingLinkForm} onSubmit={saveMeetingLink}>
                  <label>
                    <span>{session.hasMeetingLink ? "Replace Google Meet link" : "Add Google Meet link"}</span>
                    <input
                      name="meetingUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://meet.google.com/abc-defg-hij"
                      required
                    />
                  </label>
                  <button className={styles.secondaryButton} type="submit" disabled={working}>
                    Save link
                  </button>
                </form>
              ) : null}
              <form className={styles.sessionRescheduleForm} onSubmit={reschedule}>
                <label>
                  <span>New start</span>
                  <input
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={toLocalInputValue(session.startsAt)}
                    required
                  />
                </label>
                <label>
                  <span>Duration</span>
                  <select name="durationMinutes" defaultValue={String(durationMinutes)}>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </label>
                <button className={styles.secondaryButton} type="submit" disabled={working}>
                  Reschedule
                </button>
              </form>
            <div className={styles.sessionStatusActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={working}
                onClick={() => update({ action: "status", status: "missed" })}
              >
                Mark missed
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={working}
                onClick={() => update({ action: "status", status: "completed" })}
              >
                <CheckCircle2 size={14} aria-hidden="true" /> Mark complete
              </button>
            </div>
          </details>
        ) : session.cancellationReason ? (
          <p className={styles.sessionCancellationReason}>
            <strong>Cancellation note:</strong> {session.cancellationReason}
          </p>
        ) : null}
        {message ? <p className={styles.formStatus} role="status">{message}</p> : null}
      </div>
    </article>
  );
}
