import { logger, maskEmail, maskId } from "@/lib/logger";
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

  if (!session?.user?.email) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}login`);
  }

  // Use email as user ID for cross-provider account linking
  const userEmail = session.user.email;

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}api/auth/line/link/callback`;

  // Generate signed state token (contains user email, timestamp, nonce, signature)
  const state = createSignedState(userEmail);

  logger.log("[LINE Link] Starting OAuth flow for user:", maskEmail(userEmail));

  // LINE OAuth authorization URL
  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", channelId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
