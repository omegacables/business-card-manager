import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteCardButton } from "@/components/delete-card-button";
import { ExportVCardButton } from "@/components/export-buttons";
import { FollowUpButton } from "@/components/followup-button";
import { getUserPlan } from "@/lib/subscription";
import { refreshCardImageSignedUrl } from "@/lib/storage";
import type { BusinessCard, Activity } from "@/types/database";
import { Handshake, Phone, Mail, MessageCircle, StickyNote, ListChecks } from "lucide-react";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const plan = await getUserPlan();

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

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;
  const canViewImage = plan === "pro";

  // Stored URLs go stale (pre-privatization public URLs, expired signed URLs),
  // so mint a fresh short-lived signed URL on every render.
  let imageUrl: string | null = null;
  if (card.image_url && canViewImage) {
    imageUrl = await refreshCardImageSignedUrl(card.image_url);
  }

  // Activity timeline (empty until migration 004 is applied — never breaks the page)
  let activities: Activity[] = [];
  try {
    const { data: activityData } = await (supabase as any)
      .from("activities")
      .select("*")
      .eq("card_id", card.id)
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    activities = (activityData ?? []) as Activity[];
  } catch {
    activities = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{card.name}</h1>
        <div className="flex flex-wrap gap-2">
          <FollowUpButton cardId={id} cardEmail={card.email} />
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
              imageUrl ? (
                <>
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={imageUrl}
                      alt={`${card.name}の名刺`}
                      className="max-w-full md:max-w-md rounded-lg border border-border hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">クリックで拡大</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  画像を読み込めませんでした。時間をおいて再度お試しください。
                </p>
              )
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

      {/* 活動タイムライン */}
      <Card>
        <CardHeader>
          <CardTitle>やり取りの履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <ol className="relative border-l border-border ml-3 space-y-6">
              {activities.map((activity) => (
                <li key={activity.id} className="ml-6">
                  <span className="absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary">
                    <ActivityIcon type={activity.type} />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {ACTIVITY_LABEL[activity.type] ?? activity.type}
                    </span>
                    <time className="text-xs text-muted-foreground tabular-nums">
                      {new Date(activity.occurred_at).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  {activity.title && (
                    <p className="mt-1 font-medium text-foreground">{activity.title}</p>
                  )}
                  {activity.content && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {activity.content}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground">まだ記録がありません。</p>
              <p className="text-sm text-muted-foreground">
                LINEで会話を転送して「記録 {card.name}」と送ると、AIが要約してここに記録されます。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>登録日: {new Date(card.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
        <p>更新日: {new Date(card.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
      </div>
    </div>
  );
}

const ACTIVITY_LABEL: Record<string, string> = {
  meeting: "打ち合わせ",
  call: "電話",
  email: "メール",
  line: "LINE",
  note: "メモ",
  task: "タスク",
};

function ActivityIcon({ type }: { type: string }) {
  const props = { className: "w-3.5 h-3.5", strokeWidth: 1.8 };
  switch (type) {
    case "meeting":
      return <Handshake {...props} />;
    case "call":
      return <Phone {...props} />;
    case "email":
      return <Mail {...props} />;
    case "line":
      return <MessageCircle {...props} />;
    case "task":
      return <ListChecks {...props} />;
    default:
      return <StickyNote {...props} />;
  }
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
