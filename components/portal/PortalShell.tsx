"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CalendarCheck2,
  CircleUserRound,
  ClipboardList,
  FileBadge2,
  FileSearch,
  Handshake,
  HeartPulse,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Sparkles,
  Target,
  UserRoundCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./portal.module.css";
import logoImage from "@/logo1.png";
import { NotificationCenter } from "./NotificationCenter";

export type PortalRole = "client" | "coach" | "admin";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type PortalIdentity = {
  roleLabel: string;
  name: string;
  initials: string;
  eyebrow: string;
};

const roleNavigation: Record<PortalRole, NavItem[]> = {
  client: [
    { label: "Overview", href: "/client", icon: LayoutDashboard },
    { label: "Health assessment", href: "/client/assessment", icon: HeartPulse },
    { label: "Find a coach", href: "/client/coaches", icon: UserRoundCheck },
    { label: "My plan", href: "/client/plan", icon: ClipboardList },
    { label: "Schedule", href: "/client/schedule", icon: CalendarDays },
    { label: "Switch coach", href: "/client/replacement", icon: Handshake },
  ],
  coach: [
    { label: "Overview", href: "/coach", icon: LayoutDashboard },
    { label: "Certification", href: "/coach/certification", icon: BadgeCheck },
    { label: "Activate Profile", href: "/coach/activation", icon: FileBadge2 },
    { label: "My clients", href: "/coach/clients", icon: UsersRound },
    { label: "Opportunities", href: "/coach/opportunities", icon: Target },
    { label: "Switch requests", href: "/coach/switch-requests", icon: Handshake },
    { label: "Schedule", href: "/coach/schedule", icon: CalendarDays },
    { label: "Group coaching", href: "/coach/groups", icon: UsersRound },
    { label: "Public profile", href: "/coach/profile", icon: CircleUserRound },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Consultations", href: "/admin/consultations", icon: CalendarCheck2 },
    { label: "Refund requests", href: "/admin/refunds", icon: IndianRupee },
    { label: "Verification", href: "/admin/verification", icon: FileSearch },
    { label: "Coaches", href: "/admin/coaches", icon: UserRoundCheck },
    { label: "Clients", href: "/admin/users", icon: UsersRound },
    { label: "Groups", href: "/admin/groups", icon: CalendarDays },
  ],
};

const identities: Record<PortalRole, PortalIdentity> = {
  client: {
    roleLabel: "Client portal",
    name: "Client",
    initials: "C",
    eyebrow: "Client account",
  },
  coach: {
    roleLabel: "Coach portal",
    name: "Coach",
    initials: "C",
    eyebrow: "Coach account",
  },
  admin: {
    roleLabel: "Admin console",
    name: "Administrator",
    initials: "A",
    eyebrow: "Administrator",
  },
};

function isCurrentPath(pathname: string, href: string) {
  const isPortalRoot = href === "/client" || href === "/coach" || href === "/admin";
  return pathname === href || (!isPortalRoot && pathname.startsWith(`${href}/`));
}

export function PortalShell({
  role,
  displayName,
  profilePhotoUrl,
  navIndicators = {},
  children,
}: {
  role: PortalRole;
  displayName: string;
  profilePhotoUrl?: string | null;
  navIndicators?: Record<string, "warning" | "danger" | "success">;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const identity = {
    ...identities[role],
    name: displayName,
    initials: displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(""),
  };
  const navigation = roleNavigation[role];
  return (
    <div className={styles.portalFrame}>
      <button
        className={`${styles.mobileBackdrop} ${menuOpen ? styles.mobileBackdropVisible : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
        aria-label={`${identity.roleLabel} navigation`}
      >
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand} aria-label="360 Performance home">
            <span className={styles.brandMark} aria-hidden="true">
              <Image
                src={logoImage}
                alt=""
                sizes="126px"
                quality={100}
                priority
              />
            </span>
            <span>
              <strong>
                <span className={styles.brandNumber}>360</span> Performance
              </strong>
              <small>Human potential, engineered</small>
            </span>
          </Link>
          <button
            className={styles.mobileClose}
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.primaryNav}>
          <p className={styles.navLabel}>Workspace</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isCurrentPath(pathname, item.href);
            const indicator = navIndicators[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
                {indicator ? (
                  <>
                    <span className={`${styles.navAttentionDot} ${indicator === "danger" ? styles.navAttentionDotDanger : indicator === "success" ? styles.navAttentionDotSuccess : ""}`} aria-hidden="true" />
                    <span className={styles.srOnly}>{indicator === "danger" ? "Action required" : indicator === "success" ? "Accepted" : "Required"}</span>
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarUtility}>
          <Link href={`/${role}/settings`} className={styles.navLink}>
            <Settings size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            className={styles.navLink}
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>Sign out</span>
          </button>
          <div className={styles.supportCard}>
            <span className={styles.supportIcon}>
              <MessageCircle size={17} aria-hidden="true" />
            </span>
            <div>
              <strong>Need assistance?</strong>
              <p>Email our support team at</p>
              <a href="mailto:support@360performance.in">support@360performance.in</a>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.portalBody}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button
              className={styles.mobileMenu}
              type="button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.topbarActions}>
            <NotificationCenter />
            <Link
              className={styles.profileButton}
              href={`/${role}/settings`}
              aria-label="Open account settings"
            >
              <span className={styles.profileAvatarWrap}>
                <span
                  className={`${styles.avatar} ${profilePhotoUrl ? styles.avatarPhoto : ""}`}
                  style={profilePhotoUrl ? { backgroundImage: `url(${profilePhotoUrl})` } : undefined}
                >{profilePhotoUrl ? null : identity.initials}</span>
                <span className={styles.profilePresence} aria-hidden="true" />
              </span>
              <span className={styles.profileCopy}>
                <strong>{identity.name}</strong>
                <small>
                  {role === "admin" ? (
                    <>
                      <span>{identity.eyebrow}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  ) : null}
                  Settings
                </small>
              </span>
              <span className={styles.profileSettingsIcon} aria-hidden="true">
                <Settings size={15} />
              </span>
            </Link>
          </div>
        </header>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageIntro}>
      <div>
        <p className={styles.eyebrow}>
          <Sparkles size={14} aria-hidden="true" />
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {action ? <div className={styles.pageActions}>{action}</div> : null}
    </header>
  );
}
