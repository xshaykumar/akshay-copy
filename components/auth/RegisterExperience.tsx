"use client";

import { useState } from "react";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/AuthForms";
import { AuthFrame } from "@/components/public/AuthFrame";
import styles from "@/components/public/public.module.css";

export function RegisterExperience({
  initialRole,
}: {
  initialRole: "client" | "coach";
}) {
  const [role, setRole] = useState<"client" | "coach">(initialRole);

  return (
    <AuthFrame
      eyebrow="Join the platform"
      title="Begin with your role."
      copy="Create one account as a client or coach. You can complete the detailed profile later."
      storyVariant={role === "coach" ? "coach" : "default"}
    >
      <RegisterForm role={role} onRoleChange={setRole} />
      <p className={styles.authSwitch}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}
