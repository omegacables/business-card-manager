import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { draftFollowUpEmail, type FollowUpTone } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { getBearerUser, getProfileIdForBearerUser } from "@/lib/user";
import type { Activity } from "@/types/database";

const TYPE_LABEL: Record<string, string> = {
  meeting: "打ち合わせ",
  call: "電話",
  email: "メール",
  line: "LINE",
  note: "メモ",
  task: "タスク",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession();
    const supabase = createAdminClient();

    let profile: { id: string; display_name: string | null } | null = null;

    if (session) {
      const userEmail = session.user.email;
      const lineUserId = session.user.sub?.startsWith("line|")
        ? session.user.sub.replace("line|", "")
        : null;

      if (userEmail) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name")
          .eq("email", userEmail)
          .single();
        profile = data;
      }
      if (!profile && lineUserId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, display_name")
          .eq("line_user_id", lineUserId)
          .single();
        profile = data;
      }
    }

    if (!profile) {
      const bearer = await getBearerUser();
      if (bearer) {
        const profileId = await getProfileIdForBearerUser(bearer);
        if (profileId) {
          const { data } = await supabase
            .from("profiles")
            .select("id, display_name")
            .eq("id", profileId)
            .single();
          profile = data;
        }
      }
    }

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership check on the card
    const { id } = await params;
    const { data: card } = await supabase
      .from("business_cards")
      .select("id, name, company_name, position")
      .eq("id", id)
      .eq("user_id", profile.id)
      .single();

    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { tone?: string };
    const tone: FollowUpTone = body.tone === "casual" ? "casual" : "formal";

    // Recent timeline as context (missing table = empty timeline, still works)
    let timeline = "";
    try {
      const { data: activities } = await (supabase as any)
        .from("activities")
        .select("type, title, content, occurred_at")
        .eq("card_id", card.id)
        .eq("user_id", profile.id)
        .order("occurred_at", { ascending: false })
        .limit(10);

      timeline = ((activities ?? []) as Activity[])
        .map((a) => {
          const date = new Date(a.occurred_at).toLocaleDateString("ja-JP", {
            timeZone: "Asia/Tokyo",
          });
          const label = TYPE_LABEL[a.type] ?? a.type;
          return `${date}【${label}】${a.title ?? ""}\n${(a.content ?? "").slice(0, 300)}`;
        })
        .join("\n---\n");
    } catch {
      timeline = "";
    }

    const draft = await draftFollowUpEmail({
      contactName: card.name,
      companyName: card.company_name,
      position: card.position,
      timeline,
      tone,
      senderName: profile.display_name,
    });

    if (!draft) {
      return NextResponse.json(
        { error: "AIによる下書き生成に失敗しました。時間をおいて再度お試しください。" },
        { status: 502 }
      );
    }

    return NextResponse.json({ draft });
  } catch (error) {
    logger.error("[followup] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
