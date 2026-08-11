import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/public/AuthFrame";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import styles from "@/components/public/public.module.css";

export const metadata: Metadata = {
  title: "Reset Password | 360 Performance",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Reset your password."
      copy="Enter your registered email. We’ll send a secure password-reset link when the account is eligible."
    >
      <ForgotPasswordForm />
      <p className={styles.authSwitch}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthFrame>
  );
}
