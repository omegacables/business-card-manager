import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/auth";
import { getCurrentProfileId } from "@/lib/user";
import { cardInputSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentProfileId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const raw = await request.json();
    const parsed = cardInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "入力内容が不正です" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const supabase = createAdminClient();

    // Verify ownership before update.
    const { data: existing } = await supabase
      .from("business_cards")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("business_cards")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("[cards/:id] update error", error.message);
      return NextResponse.json(
        { error: "名刺の更新に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, card: data });
  } catch (error) {
    logger.error("[cards/:id] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentProfileId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("business_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logger.error("[cards/:id] delete error", error.message);
      return NextResponse.json(
        { error: "名刺の削除に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[cards/:id] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
