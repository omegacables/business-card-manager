import { getUserSubscription, getMonthlyUsage } from "@/lib/subscription";
import { PLAN_LIMITS, PLAN_PRICES, getRemainingCards } from "@/lib/plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { CheckoutButton, PortalButton } from "@/components/stripe-buttons";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const subscription = await getUserSubscription();
  const usage = await getMonthlyUsage();

  const currentPlan = subscription?.plan ?? "free";
  const cardsThisMonth = usage?.cards_registered ?? 0;
  const remaining = getRemainingCards(currentPlan, cardsThisMonth);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">料金プラン</h1>
        <p className="text-muted-foreground">
          現在のプラン: <span className="font-semibold text-foreground">{currentPlan === "pro" ? "プロ" : "無料"}</span>
        </p>
      </div>

      {/* Success/Cancel messages */}
      {params.success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg">
          プロプランへのアップグレードが完了しました！
        </div>
      )}
      {params.canceled && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg">
          決済がキャンセルされました。
        </div>
      )}

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>今月の利用状況</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-foreground">{cardsThisMonth}</div>
            <div className="text-muted-foreground">
              {remaining !== null ? (
                <>/ {PLAN_LIMITS.free.monthlyCardLimit} 枚 (残り {remaining} 枚)</>
              ) : (
                <>枚登録済み (無制限)</>
              )}
            </div>
          </div>
          {remaining !== null && remaining <= 3 && (
            <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">
              登録上限に近づいています。プロプランにアップグレードすると無制限に登録できます。
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plans Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <Card className={currentPlan === "free" ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              無料プラン
              {currentPlan === "free" && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">現在のプラン</span>
              )}
            </CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold text-foreground">¥0</span>
              <span className="text-muted-foreground"> / 月</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckIcon />
                <span>名刺保存数 無制限</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                <span>月間登録 {PLAN_LIMITS.free.monthlyCardLimit}枚まで</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                <span>LINE連携</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                <span>vCardエクスポート</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <XIcon />
                <span>名刺画像の保存</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <XIcon />
                <span>CSVエクスポート</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className={currentPlan === "pro" ? "border-primary" : "border-2 border-primary/50"}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              プロプラン
              {currentPlan === "pro" && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">現在のプラン</span>
              )}
            </CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold text-foreground">¥{PLAN_PRICES.pro.monthly}</span>
              <span className="text-muted-foreground"> / 月</span>
              <span className="ml-2 text-xs text-muted-foreground">
                (年払い ¥{PLAN_PRICES.pro.yearly}/年)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span>名刺保存数 無制限</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span className="font-semibold">月間登録 無制限</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span>LINE連携</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span>vCardエクスポート</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span className="font-semibold">名刺画像の保存</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                <span className="font-semibold">CSVエクスポート</span>
              </li>
            </ul>

            {currentPlan === "free" && (
              <div className="space-y-2">
                <CheckoutButton interval="monthly" />
                <CheckoutButton interval="yearly" />
              </div>
            )}
            {currentPlan === "pro" && (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  ご利用いただきありがとうございます
                </p>
                <PortalButton />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← 設定に戻る
        </Link>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 text-green-600 dark:text-green-400 ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
