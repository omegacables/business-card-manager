import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/auth";
import { getBearerUser, getProfileIdForBearerUser } from "@/lib/user";
import { extractCardImagePath } from "@/lib/storage";
import { logger, maskId } from "@/lib/logger";

/**
 * DELETE /api/account  (POST も同じ動作)
 *
 * Bearer認証したユーザーのアカウントと、それに紐づく全データを削除する。
 * Apple ガイドライン 5.1.1(v)（アプリ内でのアカウント削除）に対応。
 *
 * 削除対象:
 *  - Storage: card-images バケット内の当該ユーザーの名刺画像
 *  - Tables : business_cards / subscriptions / monthly_usage / activities / line_inbox（user_id）
 *  - profiles（id）
 *  - Supabase 認証ユーザー（Apple / LINEネイティブ由来。Auth0由来は対象外）
 */

const CARD_IMAGES_BUCKET = "card-images";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// user_id で紐づく子テーブル（存在しないテーブルはエラーを無視して継続）
const CHILD_TABLES = [
  "activities",
  "line_inbox",
  "monthly_usage",
  "subscriptions",
  "business_cards",
];

async function deleteAccount() {
  const bearer = await getBearerUser();
  if (!bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const profileId = await getProfileIdForBearerUser(bearer);

  if (profileId) {
    // 1) Storage: 名刺画像を削除
    try {
      const { data: cards } = await supabase
        .from("business_cards")
        .select("image_url")
        .eq("user_id", profileId);

      const paths = ((cards ?? []) as { image_url: string | null }[])
        .map((c) => extractCardImagePath(c.image_url))
        .filter((p): p is string => !!p);

      // ユーザーのフォルダ配下も列挙して確実に削除
      const { data: listed } = await supabase.storage
        .from(CARD_IMAGES_BUCKET)
        .list(profileId);
      if (listed) {
        for (const f of listed) paths.push(`${profileId}/${f.name}`);
      }

      if (paths.length > 0) {
        await supabase.storage.from(CARD_IMAGES_BUCKET).remove(paths);
      }
    } catch (e) {
      logger.error("[account] storage cleanup error", e);
    }

    // 2) 子テーブルを削除
    for (const table of CHILD_TABLES) {
      const { error } = await supabase.from(table).delete().eq("user_id", profileId);
      if (error) logger.log(`[account] delete ${table}: ${error.message}`);
    }

    // 3) プロフィール本体
    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId);
    if (profileErr) logger.error("[account] delete profile", profileErr.message);
  }

  // 4) Supabase 認証ユーザーを削除（UUID形式のみ。Auth0 sub は対象外）
  const authIds = Array.from(
    new Set([profileId, bearer.authUserId].filter(Boolean) as string[])
  );
  for (const id of authIds) {
    if (!UUID_RE.test(id)) continue;
    try {
      await supabase.auth.admin.deleteUser(id);
    } catch {
      // 対応する認証ユーザーが無い場合（Auth0由来等）は無視
    }
  }

  logger.log("[account] deleted:", maskId(profileId ?? bearer.authUserId));
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  try {
    return await deleteAccount();
  } catch (error) {
    logger.error("[account] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// 一部のHTTPクライアント向けに POST でも同じ動作を許可
export async function POST() {
  try {
    return await deleteAccount();
  } catch (error) {
    logger.error("[account] unexpected error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
