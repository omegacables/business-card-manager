import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import type { Plan, Subscription, MonthlyUsage } from "@/types/database";
import { getCurrentYearMonth, canRegisterCard, canSaveImage } from "@/lib/plans";

export async function getUserSubscription(): Promise<Subscription | null> {
  const session = await auth0.getSession();
  const userEmail = session?.user?.email;

  if (!userEmail) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userEmail)
    .single();

  if (error || !data) {
    // Create default subscription if not exists
    const { data: newSub } = await supabase
      .from("subscriptions")
      .insert({ user_id: userEmail, plan: "free", status: "active" })
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
  const session = await auth0.getSession();
  const userEmail = session?.user?.email;

  if (!userEmail) return null;

  const supabase = createAdminClient();
  const yearMonth = getCurrentYearMonth();

  const { data, error } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("user_id", userEmail)
    .eq("year_month", yearMonth)
    .single();

  if (error || !data) {
    return {
      id: "",
      user_id: userEmail,
      year_month: yearMonth,
      cards_registered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as MonthlyUsage;
}

export async function incrementCardUsage(): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  const userEmail = session?.user?.email;

  if (!userEmail) return { success: false, error: "認証エラー" };

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
        user_id: userEmail,
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
