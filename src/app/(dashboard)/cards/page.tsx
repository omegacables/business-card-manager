import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardList } from "@/components/card-list";
import { ExportCSVButton } from "@/components/export-buttons";
import { sanitizeSearchQuery } from "@/lib/validation";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/");
  }

  const { q } = await searchParams;
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

  if (!profile) {
    redirect("/settings?setup=email");
  }

  const userId = profile.id;

  let query = supabase
    .from("business_cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const safeQuery = q ? sanitizeSearchQuery(q) : "";
  if (safeQuery) {
    query = query.or(
      `name.ilike.%${safeQuery}%,company_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`
    );
  }

  const { data: cards, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">名刺一覧</h1>
        <div className="flex gap-2">
          <ExportCSVButton />
          <Link href="/cards/new">
            <Button>新規登録</Button>
          </Link>
        </div>
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
            <p className="text-destructive">エラーが発生しました</p>
          ) : cards && cards.length > 0 ? (
            <CardList cards={cards} />
          ) : q ? (
            <p className="text-muted-foreground text-center py-8">
              検索結果がありません
            </p>
          ) : (
            <div className="text-center py-10 space-y-4">
              <p className="text-muted-foreground">
                名刺がまだ登録されていません。<br className="sm:hidden" />
                最初の1枚を登録してみましょう。
              </p>
              <Link href="/cards/new">
                <Button>名刺を登録する</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
