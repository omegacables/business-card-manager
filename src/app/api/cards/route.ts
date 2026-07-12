import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/auth";
import { incrementCardUsage } from "@/lib/subscription";
import { getCurrentProfileId } from "@/lib/user";
import { cardInputSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

// 名刺一覧を返す。iOSアプリは Authorization: Bearer <token>、Webは Cookie セッションで認証。
// （getCurrentProfileId が Auth0セッション/Supabase Bearer の両方を解決する）
// 各カードは business_cards の全カラム（cardInputSchema の snake_case 項目 + id, created_at 等）を含む。
export async function GET() {
  try {
    const userId = await getCurrentProfileId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("business_cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[cards] list error", error.message);
      return NextResponse.json(
        { error: "名刺の取得に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: data ?? [] });
  } catch (error) {
    logger.error("[cards] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentProfileId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = cardInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力内容が不正です" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Atomically check + increment monthly usage.
    const usageResult = await incrementCardUsage();
    if (!usageResult.success) {
      return NextResponse.json(
        { error: usageResult.error, limitReached: true },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("business_cards")
      .insert({
        user_id: userId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      logger.error("[cards] create error", error.message);
      return NextResponse.json(
        { error: "名刺の登録に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, card: data });
  } catch (error) {
    logger.error("[cards] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
