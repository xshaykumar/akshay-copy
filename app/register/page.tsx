import type { Metadata } from "next";
import { RegisterExperience } from "@/components/auth/RegisterExperience";

export const metadata: Metadata = {
  title: "Create Account | 360 Performance",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  return <RegisterExperience initialRole={role === "coach" ? "coach" : "client"} />;
}
