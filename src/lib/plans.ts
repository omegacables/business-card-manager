import type { Plan } from "@/types/database";

export interface PlanLimits {
  monthlyCardLimit: number | null; // null = unlimited
  imageStorage: boolean;
  csvExport: boolean;
  advancedSearch: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    monthlyCardLimit: 10,
    imageStorage: false,
    csvExport: false,
    advancedSearch: false,
  },
  pro: {
    monthlyCardLimit: null, // unlimited
    imageStorage: true,
    csvExport: true,
    advancedSearch: true,
  },
};

export const PLAN_PRICES = {
  pro: {
    monthly: 390,
    yearly: 3900, // ~17% discount
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canRegisterCard(plan: Plan, currentMonthlyCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (limits.monthlyCardLimit === null) return true;
  return currentMonthlyCount < limits.monthlyCardLimit;
}

export function canSaveImage(plan: Plan): boolean {
  return getPlanLimits(plan).imageStorage;
}

export function canExportCSV(plan: Plan): boolean {
  return getPlanLimits(plan).csvExport;
}

export function getRemainingCards(plan: Plan, currentMonthlyCount: number): number | null {
  const limits = getPlanLimits(plan);
  if (limits.monthlyCardLimit === null) return null;
  return Math.max(0, limits.monthlyCardLimit - currentMonthlyCount);
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
