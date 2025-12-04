import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  // Check if user is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}login`);
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}api/auth/line/link/callback`;

  // Generate state for CSRF protection (include user id)
  const state = `link_${user.id}_${randomBytes(16).toString("hex")}`;

  // Store state in cookie
  const cookieStore = await cookies();
  cookieStore.set("line_link_state", state, {
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
