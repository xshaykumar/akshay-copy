import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/public/AuthFrame";
import { LoginForm } from "@/components/auth/AuthForms";
import styles from "@/components/public/public.module.css";

export const metadata: Metadata = {
  title: "Sign In | 360 Performance",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; password?: string }>;
}) {
  const parameters = await searchParams;
  const recoveryError =
    parameters.error === "recovery-link-invalid"
      ? "This password-reset link is invalid, expired, or has already been used. Request a new reset link."
      : "";
  const passwordUpdated =
    parameters.password === "updated"
      ? "Your password has been updated. Sign in with your new password."
      : "";

  return (
    <AuthFrame
      eyebrow="Welcome back"
      title="Continue your progress."
      copy="Sign in to access your coaching, sessions, and profile."
    >
      <LoginForm
        initialError={recoveryError}
        initialSuccess={passwordUpdated}
      />
      <p className={styles.authSwitch}><Link href="/forgot-password">Forgot password?</Link></p>
      <p className={styles.authSwitch}>
        New to 360 Performance? <Link href="/register">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
