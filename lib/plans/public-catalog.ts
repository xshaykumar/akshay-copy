import {
  PLAN_DURATION_DAYS,
  serviceCycleCount,
} from "./duration";

export const publicPlanDurations = PLAN_DURATION_DAYS;

export type PublicPlanDuration = (typeof publicPlanDurations)[number];

export type PublicPlan = {
  slug: string;
  name: string;
  mode: "Online" | "Offline";
  cycleRate: number;
  discounts: Record<PublicPlanDuration, number>;
  features: string[];
  clientProvides?: string;
};

export const publicPlans: PublicPlan[] = [
  {
    slug: "online-basic",
    name: "Online Basic",
    mode: "Online",
    cycleRate: 5000,
    discounts: { 90: 10, 180: 15, 365: 20 },
    features: [
      "1 live session with your coach every week",
      "Personalized workout and diet plans",
      "Weekly progress check-in",
      "Exercise technique review",
      "Progress review during coaching sessions",
    ],
  },
  {
    slug: "online-plus",
    name: "Online Plus",
    mode: "Online",
    cycleRate: 8000,
    discounts: { 90: 10, 180: 15, 365: 20 },
    features: [
      "4 live sessions every week",
      "Personalized workout and nutrition programs",
      "Weekly progress tracking",
      "Exercise technique analysis",
      "Priority coaching support",
    ],
  },
  {
    slug: "online-elite",
    name: "Online Elite",
    mode: "Online",
    cycleRate: 10000,
    discounts: { 90: 10, 180: 15, 365: 20 },
    features: [
      "Live coaching 6 days every week",
      "Unlimited workout adjustments",
      "Personalized nutrition",
      "Advanced performance programming",
      "Weekly progress review and highest-priority support",
    ],
  },
  {
    slug: "group-online-coaching",
    name: "Group Online Coaching",
    mode: "Online",
    cycleRate: 4000,
    discounts: { 90: 10, 180: 15, 365: 20 },
    features: [
      "Live group sessions",
      "Nutrition guidance",
      "Community support",
      "Progress tracking",
      "Assessment during every 30-day cycle",
    ],
  },
  {
    slug: "offline-personal-training",
    name: "Offline Personal Training",
    mode: "Offline",
    cycleRate: 25000,
    discounts: { 90: 12, 180: 16, 365: 20 },
    features: [
      "One-to-one personal training",
      "Gym or home training",
      "Performance testing",
      "Mobility and recovery",
      "Nutrition guidance and progress monitoring",
    ],
  },
  {
    slug: "athlete-executive",
    name: "Athlete / Executive Performance",
    mode: "Offline",
    cycleRate: 150000,
    discounts: { 90: 14, 180: 18, 365: 25 },
    features: [
      "Dedicated performance coach",
      "Flexible daily training schedule",
      "Strength, conditioning, and sports nutrition",
      "Recovery, mobility, and rehabilitation planning",
      "Performance analysis and competition preparation",
      "Lifestyle management",
    ],
    clientProvides: "Travel, accommodation, and food",
  },
];

export function publicPlanTotal(
  plan: PublicPlan,
  durationDays: PublicPlanDuration,
) {
  const cycles = serviceCycleCount(durationDays);
  return (
    (plan.cycleRate *
      cycles *
      (100 - plan.discounts[durationDays])) /
    100
  );
}

export const publicPlanCurrency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
