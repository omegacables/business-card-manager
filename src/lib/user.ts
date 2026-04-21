/**
 * Centralized user profile lookup helpers.
 * Previously duplicated across 5+ API route files; consolidated here.
 */

import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

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
