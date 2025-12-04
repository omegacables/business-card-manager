import { createClient } from "@/lib/supabase/server";
import type { Plan, Subscription, MonthlyUsage } from "@/types/database";
import { getCurrentYearMonth, canRegisterCard, canSaveImage } from "@/lib/plans";

export async function getUserSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    // Create default subscription if not exists
    const { data: newSub } = await (supabase as any)
      .from("subscriptions")
      .insert({ user_id: user.id, plan: "free", status: "active" })
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const yearMonth = getCurrentYearMonth();

  const { data, error } = await (supabase as any)
    .from("monthly_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("year_month", yearMonth)
    .single();

  if (error || !data) {
    return {
      id: "",
      user_id: user.id,
      year_month: yearMonth,
      cards_registered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as MonthlyUsage;
}

export async function incrementCardUsage(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "認証エラー" };

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
  const { error } = await (supabase as any)
    .from("monthly_usage")
    .upsert(
      {
        user_id: user.id,
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
