import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteCardButton } from "@/components/delete-card-button";
import { ExportVCardButton } from "@/components/export-buttons";
import { getUserPlan } from "@/lib/subscription";
import type { BusinessCard } from "@/types/database";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const plan = await getUserPlan();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;
  const canViewImage = plan === "pro";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{card.name}</h1>
        <div className="flex flex-wrap gap-2">
          <ExportVCardButton cardId={id} />
          <Link href={'/cards/' + id + '/edit'}>
            <Button variant="outline">編集</Button>
          </Link>
          <DeleteCardButton cardId={id} cardName={card.name} />
        </div>
      </div>

      {/* 名刺画像 */}
      {card.image_url && (
        <Card>
          <CardHeader>
            <CardTitle>名刺画像</CardTitle>
          </CardHeader>
          <CardContent>
            {canViewImage ? (
              <>
                <a href={card.image_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={card.image_url}
                    alt={`${card.name}の名刺`}
                    className="max-w-full md:max-w-md rounded-lg border border-border hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </a>
                <p className="text-xs text-muted-foreground mt-2">クリックで拡大</p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 bg-muted/50 rounded-lg border border-dashed border-border">
                <svg className="w-12 h-12 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-muted-foreground text-center mb-3">
                  名刺画像の表示はProプラン限定機能です
                </p>
                <Link href="/pricing">
                  <Button size="sm" variant="outline">
                    Proプランにアップグレード
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="氏名" value={card.name} />
            <InfoRow label="氏名（カナ）" value={card.name_kana} />
            <InfoRow label="会社名" value={card.company_name} />
            <InfoRow label="部署" value={card.department} />
            <InfoRow label="役職" value={card.position} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="メール" value={card.email} isEmail />
            <InfoRow label="電話" value={card.phone} />
            <InfoRow label="携帯" value={card.mobile} />
            <InfoRow label="FAX" value={card.fax} />
            <InfoRow label="ウェブサイト" value={card.website} isUrl />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>住所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="郵便番号" value={card.postal_code} />
            <InfoRow label="住所" value={card.address} />
          </CardContent>
        </Card>

        {card.notes && (
          <Card>
            <CardHeader>
              <CardTitle>メモ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{card.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        <p>登録日: {new Date(card.created_at).toLocaleString("ja-JP")}</p>
        <p>更新日: {new Date(card.updated_at).toLocaleString("ja-JP")}</p>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isEmail,
  isUrl,
}: {
  label: string;
  value: string | null;
  isEmail?: boolean;
  isUrl?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/50">-</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {isEmail ? (
        <a href={'mailto:' + value} className="text-primary hover:underline truncate">
          {value}
        </a>
      ) : isUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-foreground truncate">{value}</span>
      )}
    </div>
  );
}
