import { NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";

// Create signed state token (no cookies needed for login flow)
function createSignedLoginState(): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `login.${timestamp}.${nonce}`;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const signature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${signature}`;
}

export async function GET() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const redirectUri = `${siteUrl}api/auth/line/callback`;

  console.log("[LINE Auth] Starting OAuth flow");
  console.log("[LINE Auth] Channel ID:", channelId ? "SET" : "NOT SET");
  console.log("[LINE Auth] Site URL:", siteUrl);
  console.log("[LINE Auth] Redirect URI:", redirectUri);

  if (!channelId) {
    console.error("[LINE Auth] LINE_LOGIN_CHANNEL_ID is not set");
    return NextResponse.redirect(`${siteUrl}login?error=configuration_error`);
  }

  // Generate signed state token (contains timestamp, nonce, signature)
  const state = createSignedLoginState();

  // LINE OAuth authorization URL
  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
