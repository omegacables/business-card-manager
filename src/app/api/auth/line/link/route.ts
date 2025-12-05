import { NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";
import { auth0 } from "@/lib/auth0";

// Create signed state token (Base64 URL-safe encoded)
function createSignedState(userId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const data = { t: "link", u: userId, ts: timestamp, n: nonce };
  const payload = JSON.stringify(data);
  const secret = process.env.AUTH0_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const signature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  const stateData = { ...data, s: signature };
  return Buffer.from(JSON.stringify(stateData)).toString("base64url");
}

export async function GET() {
  // Check if user is logged in with Auth0
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}login`);
  }

  // Use Auth0 user ID (sub)
  const user = { id: session.user.sub };

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
