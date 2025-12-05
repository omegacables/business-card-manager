import { NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";
import { createClient } from "@/lib/supabase/server";

// Create signed state token (no cookies needed)
function createSignedState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${userId}.${timestamp}.${nonce}`;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const signature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${signature}`;
}

export async function GET() {
  // Check if user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}login`);
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}api/auth/line/link/callback`;

  // Generate signed state token (contains user id, timestamp, nonce, signature)
  const state = createSignedState(user.id);

  console.log("[LINE Link] Starting OAuth flow for user:", user.id);

  // LINE OAuth authorization URL
  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
