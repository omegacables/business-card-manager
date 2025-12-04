import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { BusinessCard } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { count: cardCount } = await supabase
    .from("business_cards")
    .select("*", { count: "exact", head: true });

  const { data } = await supabase
    .from("business_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const recentCards = (data || []) as BusinessCard[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              登録済み名刺
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{cardCount ?? 0}</p>
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
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{card.name}</p>
                      <p className="text-sm text-gray-500">
                        {card.company_name}
                        {card.position && ' - ' + card.position}
                      </p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(card.created_at).toLocaleDateString("ja-JP")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-8">
              名刺がまだ登録されていません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
