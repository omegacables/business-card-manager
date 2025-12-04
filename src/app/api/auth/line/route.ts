import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

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

  // Generate state for CSRF protection
  const state = randomBytes(16).toString("hex");

  // Store state in cookie
  const cookieStore = await cookies();
  cookieStore.set("line_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });

  // LINE OAuth authorization URL
  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
