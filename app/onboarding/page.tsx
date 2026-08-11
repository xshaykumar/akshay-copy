import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/public/AuthFrame";
import { CompleteProfileForm } from "@/components/auth/AuthForms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Complete Profile | 360 Performance",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <AuthFrame
      eyebrow="One final step"
      title="Complete your profile."
      copy="Choose your account type and public username before entering the platform."
    >
      <CompleteProfileForm />
    </AuthFrame>
  );
}
