import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteCardButton } from "@/components/delete-card-button";
import { ExportVCardButton } from "@/components/export-buttons";
import type { BusinessCard } from "@/types/database";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;

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
