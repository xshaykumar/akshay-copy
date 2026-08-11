import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/public/AuthFrame";
import { MfaForm } from "@/components/auth/AuthForms";
import { getCurrentAppUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin MFA | 360 Performance",
};

export default async function MfaPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("admin")) {
    redirect(user.roles.includes("coach") ? "/coach" : "/client");
  }
  if (user.aal === "aal2") redirect("/admin");
  return (
    <AuthFrame
      eyebrow="Administrator security"
      title="Verify multi-factor authentication."
      copy="Admin access requires a verified authenticator factor on every elevated session."
    >
      <MfaForm />
    </AuthFrame>
  );
}
