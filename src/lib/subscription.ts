import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import type { Plan, Subscription, MonthlyUsage } from "@/types/database";
import { getCurrentYearMonth, canRegisterCard, canSaveImage } from "@/lib/plans";

// Helper to get user's profile ID
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
    // Create default subscription if not exists
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

export async function incrementCardUsage(): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserProfileId();

  if (!userId) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();
  const yearMonth = getCurrentYearMonth();
  const plan = await getUserPlan();
  const usage = await getMonthlyUsage();

  if (!canRegisterCard(plan, usage?.cards_registered ?? 0)) {
    return {
      success: false,
      error: "今月の登録上限に達しました。プロプランにアップグレードすると無制限に登録できます。",
    };
  }

  // Upsert usage record
  const { error } = await supabase
    .from("monthly_usage")
    .upsert(
      {
        user_id: userId,
        year_month: yearMonth,
        cards_registered: (usage?.cards_registered ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year_month" }
    );

  if (error) {
    console.error("Usage increment error:", error);
    return { success: false, error: "使用量の更新に失敗しました" };
  }

  return { success: true };
}

export async function checkCanRegisterCard(): Promise<{ allowed: boolean; remaining: number | null; error?: string }> {
  const plan = await getUserPlan();
  const usage = await getMonthlyUsage();
  const currentCount = usage?.cards_registered ?? 0;

  const allowed = canRegisterCard(plan, currentCount);
  const limits = await import("@/lib/plans").then(m => m.getPlanLimits(plan));
  const remaining = limits.monthlyCardLimit === null ? null : Math.max(0, limits.monthlyCardLimit - currentCount);

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      error: "今月の登録上限（10枚）に達しました",
    };
  }

  return { allowed, remaining };
}

export async function checkCanSaveImage(): Promise<boolean> {
  const plan = await getUserPlan();
  return canSaveImage(plan);
}
