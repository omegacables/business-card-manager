import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { BusinessCard } from "@/types/database";
import { getUserSubscription } from "@/lib/subscription";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/");
  }

  const supabase = createAdminClient();

  // プロフィールを取得（メールまたはLINE IDで）
  const userEmail = session.user.email;
  const lineUserId = session.user.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  let profile = null;
  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }

  // プロフィールがない場合は設定ページへ
  if (!profile) {
    redirect("/settings?setup=email");
  }

  // プロフィールのIDをuser_idとして使用
  const userId = profile.id;

  const subscription = await getUserSubscription();

  const { count: cardCount } = await supabase
    .from("business_cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data } = await supabase
    .from("business_cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentCards = (data || []) as BusinessCard[];
  const isPro = subscription?.plan === "pro";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
        <Link href="/pricing">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            isPro
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}>
            {isPro ? "Pro" : "Free"}
          </span>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              登録済み名刺
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{cardCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近登録した名刺</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCards.length > 0 ? (
            <ul className="space-y-3">
              {recentCards.map((card) => (
                <li key={card.id}>
                  <Link
                    href={'/cards/' + card.id}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{card.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.company_name}
                        {card.position && ' - ' + card.position}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(card.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              名刺がまだ登録されていません
            </p>
          )}
        </CardContent>
      </Card>

      {/* LINE読み込みバナー */}
      <a
        href={process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="relative overflow-hidden rounded-xl bg-[#06C755] p-6 md:p-8 text-white hover:opacity-95 transition-opacity">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="shrink-0">
              <svg className="w-16 h-16 md:w-20 md:h-20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-bold mb-1">LINEで名刺を読み込む</h3>
              <p className="text-white/90 text-sm md:text-base">
                LINEで写真を送るだけで簡単に名刺を登録できます
              </p>
            </div>
            <div className="hidden md:block shrink-0">
              <div className="bg-white/20 rounded-full p-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}
