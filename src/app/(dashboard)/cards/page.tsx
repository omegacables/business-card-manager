import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardList } from "@/components/card-list";
import { ExportCSVButton } from "@/components/export-buttons";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("business_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data: cards, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">名刺一覧</h1>
        <ExportCSVButton />
        <Link href="/cards/new">
          <Button>新規登録</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="mb-6">
            <Input
              name="q"
              placeholder="名前、会社名、メールで検索..."
              defaultValue={q}
              className="max-w-md"
            />
          </form>

          {error ? (
            <p className="text-red-500">エラーが発生しました</p>
          ) : cards && cards.length > 0 ? (
            <CardList cards={cards} />
          ) : (
            <p className="text-gray-500 text-center py-8">
              {q ? "検索結果がありません" : "名刺がまだ登録されていません"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
