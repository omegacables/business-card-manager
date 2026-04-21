import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import type { Plan, Subscription, MonthlyUsage } from "@/types/database";
import { getCurrentYearMonth, canSaveImage, getPlanLimits } from "@/lib/plans";
import { logger } from "@/lib/logger";

// Helper to get user's profile ID (used only inside this file).
async function getUserProfileId(): Promise<string | null> {
  const session = await auth0.getSession();
  if (!session) return null;

  const supabase = createAdminClient();
  const userEmail = session.user.email;
  const lineUserId = session.user.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  let profile = null;
  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }
  return profile?.id || null;
}

export async function getUserSubscription(): Promise<Subscription | null> {
  const userId = await getUserProfileId();
  if (!userId) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    const { data: newSub } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, plan: "free", status: "active" })
      .select()
      .single();
    return newSub as Subscription | null;
  }

  return data as Subscription;
}

export async function getUserPlan(): Promise<Plan> {
  const subscription = await getUserSubscription();
  return subscription?.plan ?? "free";
}

export async function getMonthlyUsage(): Promise<MonthlyUsage | null> {
  const userId = await getUserProfileId();
  if (!userId) return null;

  const supabase = createAdminClient();
  const yearMonth = getCurrentYearMonth();

  const { data, error } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("year_month", yearMonth)
    .single();

  if (error || !data) {
    return {
      id: "",
      user_id: userId,
      year_month: yearMonth,
      cards_registered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as MonthlyUsage;
}

/**
 * Atomically check + increment this user's monthly card registration count.
 * Uses the `increment_card_usage` Postgres function (migration 003) so
 * concurrent requests cannot bypass the limit.
 */
export async function incrementCardUsage(): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserProfileId();
  if (!userId) return { success: false, error: "認証エラー" };

  const plan = await getUserPlan();
  const limits = getPlanLimits(plan);
  const yearMonth = getCurrentYearMonth();

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("increment_card_usage", {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_max_count: limits.monthlyCardLimit, // null means unlimited (pro)
  });

  if (error) {
    logger.error("[subscription] atomic increment error", error.message);
    return { success: false, error: "使用量の更新に失敗しました" };
  }

  // RPC returns TABLE so data is an array of rows.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) {
    return {
      success: false,
      error:
        row?.error_message ||
        `今月の登録上限（${limits.monthlyCardLimit}枚）に達しました。プロプランにアップグレードすると無制限に登録できます。`,
    };
  }
  return { success: true };
}

export async function checkCanRegisterCard(): Promise<{
  allowed: boolean;
  remaining: number | null;
  error?: string;
}> {
  const plan = await getUserPlan();
  const usage = await getMonthlyUsage();
  const currentCount = usage?.cards_registered ?? 0;
  const limits = getPlanLimits(plan);

  if (limits.monthlyCardLimit !== null && currentCount >= limits.monthlyCardLimit) {
    return {
      allowed: false,
      remaining: 0,
      error: `今月の登録上限（${limits.monthlyCardLimit}枚）に達しました`,
    };
  }

  const remaining =
    limits.monthlyCardLimit === null
      ? null
      : Math.max(0, limits.monthlyCardLimit - currentCount);
  return { allowed: true, remaining };
}

export async function checkCanSaveImage(): Promise<boolean> {
  const plan = await getUserPlan();
  return canSaveImage(plan);
}
