import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";
import styles from "./portal.module.css";

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.primaryButton}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.secondaryButton}>
      {children}
    </Link>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={styles.primaryButton} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={styles.secondaryButton} {...props}>
      {children}
    </button>
  );
}

export function IconAction({
  label,
  icon: Icon,
  ...props
}: {
  label: string;
  icon: LucideIcon;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={styles.tableIconButton} aria-label={label} {...props}>
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

export function StatCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  tone = "bronze",
  valueTone,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: "up" | "down";
  icon: LucideIcon;
  tone?: "bronze" | "orange" | "green" | "black";
  valueTone?: "success" | "danger";
}) {
  return (
    <article className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[`statIcon${tone}`]}`}>
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className={styles.statCopy}>
        <p>{label}</p>
        <strong className={valueTone ? styles[`statValue${valueTone}`] : undefined}>{value}</strong>
        <span className={trend ? styles.trend : styles.statDetail}>
          {trend === "up" ? <ArrowUpRight size={12} aria-hidden="true" /> : null}
          {trend === "down" ? <ArrowDownRight size={12} aria-hidden="true" /> : null}
          {detail}
        </span>
      </div>
    </article>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${styles.panel} ${className}`}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  href,
  linkLabel = "View all",
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <header className={styles.panelHeader}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className={styles.textLink}>
          {linkLabel}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </header>
  );
}

export function DataTable({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {headings.map((heading) => <th key={heading}>{heading}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "gold" | "info";
}) {
  return <span className={`${styles.statusBadge} ${styles[`status${tone}`]}`}>{children}</span>;
}

export function Avatar({ initials, tone = 1 }: { initials: string; tone?: number }) {
  return (
    <span className={`${styles.listAvatar} ${styles[`avatarTone${tone}`]}`} aria-hidden="true">
      {initials}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.progressTrack} aria-label={`${label}: ${value}%`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={styles.progressFill} style={{ "--progress": `${value}%` } as CSSProperties} />
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
