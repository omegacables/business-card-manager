/**
 * Centralized user profile lookup helpers.
 * Previously duplicated across 5+ API route files; consolidated here.
 */

import { auth0 } from "@/lib/auth0";
import { createAdminClient, auth0IssuerBaseUrl } from "@/lib/auth";

type SessionShape = {
  user: { email?: string; sub?: string };
} | null | undefined;

/**
 * Resolve the current user's profile id from the Auth0 session.
 * Looks up by email first, then by LINE user id as a fallback.
 * Returns null if no profile is found or the user isn't authenticated.
 */
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

/** Shortcut that fetches the Auth0 session internally. */
export async function getCurrentProfileId(): Promise<string | null> {
  const session = await auth0.getSession();
  return getUserProfileIdFromSession(session);
}

export interface BearerUser {
  email?: string | null;
  sub?: string | null;
  name?: string | null;
  picture?: string | null;
}

/**
 * iOSアプリが渡す Bearer トークンからユーザー情報を取得する。
 *  - Google/LINE: Auth0 の access_token → Auth0 /userinfo で検証
 *  - Apple: Supabase の access_token → supabase.auth.getUser で検証
 * どちらでもなければ null。
 */
export async function getBearerUser(token: string): Promise<BearerUser | null> {
  // 1) Auth0（Google/LINE）
  const issuer = auth0IssuerBaseUrl();
  const res = await fetch(`${issuer}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const u = await res.json();
    return { email: u.email, sub: u.sub, name: u.name, picture: u.picture };
  }

  // 2) Supabase（Apple）
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    const u = data.user;
    const meta = u.user_metadata || {};
    return {
      email: u.email ?? null,
      sub: `apple|${u.id}`,
      name: meta.full_name || meta.name || null,
      picture: meta.avatar_url || meta.picture || null,
    };
  }

  return null;
}

/** Bearer トークンからプロフィールIDを解決（未認証/プロフィール無しは null）。 */
export async function getProfileIdFromBearer(token: string): Promise<string | null> {
  const user = await getBearerUser(token);
  if (!user) return null;
  return getUserProfileIdFromSession({
    user: { email: user.email ?? undefined, sub: user.sub ?? undefined },
  });
}
