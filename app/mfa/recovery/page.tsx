import type { Metadata } from "next";
import { AuthFrame } from "@/components/public/AuthFrame";
import { RecoveryMfaForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: "Verify MFA | 360 Performance",
};

export default function RecoveryMfaPage() {
  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Verify multi-factor authentication."
      copy="Enter the six-digit code from your authenticator app to continue resetting your password."
    >
      <RecoveryMfaForm />
    </AuthFrame>
  );
}
