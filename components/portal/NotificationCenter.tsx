"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./portal.module.css";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

function notificationIcon(type: string): LucideIcon {
  if (type.startsWith("session.")) return CalendarClock;
  if (type.startsWith("assignment.") || type.startsWith("switch.")) {
    return UsersRound;
  }
  if (type.startsWith("coach.") || type.startsWith("account.")) {
    return BadgeCheck;
  }
  if (type.startsWith("assessment.")) return ClipboardCheck;
  if (
    type.startsWith("plan.") ||
    type.startsWith("refund.") ||
    type.startsWith("admin.refund") ||
    type.startsWith("admin.consultation")
  ) {
    return WalletCards;
  }
  return Sparkles;
}

function relativeTime(value: string) {
  const createdAt = new Date(value);
  const elapsed = Date.now() - createdAt.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return createdAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as {
      notifications?: NotificationRow[];
      unreadCount?: number;
    };
    setRows(body.notifications ?? []);
    setUnreadCount(body.unreadCount ?? 0);
    setLoaded(true);
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        open &&
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markRead(notificationId: string) {
    const row = rows.find((item) => item.id === notificationId);
    if (!row || row.readAt) return;
    const now = new Date().toISOString();
    setRows((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, readAt: now } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", notificationId }),
    });
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setRows((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
    );
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
  }

  return (
    <div className={styles.notificationCenter} ref={rootRef}>
      <button
        className={`${styles.notificationButton} ${unreadCount > 0 ? styles.notificationButtonActive : ""}`}
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-controls="portal-notifications"
        onClick={() => {
          setOpen((current) => !current);
          if (!loaded) void load();
        }}
      >
        <span className={styles.notificationBell}>
          <Bell size={18} aria-hidden="true" />
        </span>
        <span className={styles.notificationButtonCopy}>
          <strong>Updates</strong>
          <small>{unreadCount > 0 ? `${unreadCount} new` : "All caught up"}</small>
        </span>
        {unreadCount > 0 ? (
          <span className={styles.notificationCount}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          id="portal-notifications"
          className={styles.notificationPanel}
          aria-label="Notifications"
        >
          <header className={styles.notificationHeader}>
            <div className={styles.notificationHeaderIcon}>
              <BellRing size={18} aria-hidden="true" />
            </div>
            <div className={styles.notificationHeaderCopy}>
              <strong>Notifications</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} update${unreadCount === 1 ? "" : "s"} waiting for you`
                  : "You are all caught up"}
              </span>
            </div>
            <button
              className={styles.notificationClose}
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {unreadCount > 0 ? (
            <button
              className={styles.notificationReadAll}
              type="button"
              onClick={() => void markAllRead()}
            >
              <CheckCheck size={15} aria-hidden="true" />
              Mark all as read
            </button>
          ) : null}
          <div className={styles.notificationList}>
            {!loaded ? (
              <div className={styles.notificationLoading} aria-label="Loading notifications">
                <span />
                <span />
                <span />
              </div>
            ) : rows.length === 0 ? (
              <div className={styles.notificationEmpty}>
                <span><CheckCheck size={22} aria-hidden="true" /></span>
                <strong>Nothing new right now</strong>
                <p>Important account updates will appear here.</p>
              </div>
            ) : (
              rows.map((row) => {
                const ItemIcon = notificationIcon(row.type);
                const content = (
                  <>
                    <span className={styles.notificationItemIcon}>
                      <ItemIcon size={16} aria-hidden="true" />
                    </span>
                    <span className={styles.notificationItemCopy}>
                      <span className={styles.notificationItemTitle}>
                        {row.title}
                      </span>
                      <span className={styles.notificationItemBody}>
                        {row.body}
                      </span>
                      <time dateTime={row.createdAt} title={new Date(row.createdAt).toLocaleString("en-IN")}>
                        <Clock3 size={11} aria-hidden="true" />
                        {relativeTime(row.createdAt)}
                      </time>
                    </span>
                    {row.actionUrl ? (
                      <ArrowUpRight
                        className={styles.notificationItemArrow}
                        size={15}
                        aria-hidden="true"
                      />
                    ) : null}
                  </>
                );
                return row.actionUrl ? (
                  <Link
                    className={`${styles.notificationItem} ${row.readAt ? "" : styles.notificationUnread}`}
                    href={row.actionUrl}
                    key={row.id}
                    onClick={() => {
                      void markRead(row.id);
                      setOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    className={`${styles.notificationItem} ${row.readAt ? "" : styles.notificationUnread}`}
                    type="button"
                    key={row.id}
                    onClick={() => void markRead(row.id)}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
