/**
 * Centralized user profile lookup helpers.
 * 認証は2方式に対応:
 * 1. Auth0のCookieセッション（Webブラウザ）
 * 2. `Authorization: Bearer <Supabaseアクセストークン>`（モバイルアプリ）
 */

import { headers } from "next/headers";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

type SessionShape = {
  user: { email?: string; sub?: string };
} | null | undefined;

export type BearerUser = {
  authUserId: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  lineUserId: string | null;
};

export async function getUserProfileIdFromSession(
  session: SessionShape
): Promise<string | null> {
  if (!session) return null;

  const supabase = createAdminClient();
  const userEmail = session.user?.email;
  const lineUserId = session.user?.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .single();
    if (data?.id) return data.id;
  }

  if (lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();
    if (data?.id) return data.id;
  }

  return null;
}

/** BearerトークンからSupabaseユーザーを解決する（無効なら null）。 */
export async function getBearerUser(): Promise<BearerUser | null> {
  const headerList = await headers();
  const authHeader = headerList.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    authUserId: data.user.id,
    email: data.user.email ?? null,
    name: typeof meta.display_name === "string" ? meta.display_name : null,
    picture: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
    lineUserId: typeof meta.line_user_id === "string" ? meta.line_user_id : null,
  };
}

/** Bearerユーザーのプロフィールを id → email → line_user_id の順で検索。 */
export async function getProfileIdForBearerUser(
  user: BearerUser
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: byId } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.authUserId)
    .single();
  if (byId?.id) return byId.id;

  if (user.email) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", user.email)
      .single();
    if (data?.id) return data.id;
  }

  if (user.lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", user.lineUserId)
      .single();
    if (data?.id) return data.id;
  }

  return null;
}

/** Auth0セッション（Web）または Bearerトークン（モバイル）からプロフィールIDを解決。 */
export async function getCurrentProfileId(): Promise<string | null> {
  const session = await auth0.getSession();
  const fromSession = await getUserProfileIdFromSession(session);
  if (fromSession) return fromSession;

  const bearer = await getBearerUser();
  if (bearer) return getProfileIdForBearerUser(bearer);

  return null;
}
