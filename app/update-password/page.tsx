import type { Metadata } from "next";
import { AuthFrame } from "@/components/public/AuthFrame";
import { UpdatePasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: "Choose New Password | 360 Performance",
};

export default function UpdatePasswordPage() {
  return (
    <AuthFrame
      eyebrow="Account recovery"
      title="Choose a new password."
      copy="Use at least 6 characters and do not reuse a password from another service."
    >
      <UpdatePasswordForm />
    </AuthFrame>
  );
}
