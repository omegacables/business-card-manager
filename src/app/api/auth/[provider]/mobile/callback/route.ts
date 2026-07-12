import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, auth0IssuerBaseUrl } from "@/lib/auth";
import { randomUUID, createHmac } from "crypto";
import { logger, maskEmail, maskId } from "@/lib/logger";

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

// カスタムスキームへ 302（NextResponse.redirect は http/https 前提のため手動でLocationを組む）
function redirectToApp(appRedirect: string, params: Record<string, string>): NextResponse {
  const query = new URLSearchParams(params).toString();
  return new NextResponse(null, {
    status: 302,
    headers: { Location: `${appRedirect}?${query}` },
  });
}

// mobile/route.ts の signMobileState と対になる検証
function verifyMobileState(
  state: string
): { r: string; st: string; p: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const { s, ...body } = decoded;
    const secret = process.env.AUTH0_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const expected = createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex")
      .slice(0, 16);
    if (s !== expected) return null;
    if (typeof body.ts !== "number" || Date.now() - body.ts > 10 * 60 * 1000) return null;
    if (typeof body.r !== "string" || !body.r.startsWith("meishikanri://")) return null;
    return { r: body.r, st: body.st ?? "", p: body.p };
  } catch {
    return null;
  }
}

interface Auth0UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

// Web版 onCallback と同じく、ログインユーザーの profile / subscription を用意する
async function upsertProfile(u: Auth0UserInfo) {
  const supabase = createAdminClient();
  const email = u.email;
  const lineUserId = u.sub?.startsWith("line|") ? u.sub.replace("line|", "") : null;

  if (email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, line_user_id")
      .eq("email", email)
      .single();

    if (!profile) {
      const newId = randomUUID();
      const { error: insertError } = await supabase.from("profiles").insert({
        id: newId,
        email,
        display_name: u.name || null,
        line_user_id: lineUserId,
      });
      if (insertError) {
        logger.error("[Mobile Callback] Profile insert error:", JSON.stringify(insertError));
      } else {
        await supabase.from("subscriptions").insert({
          user_id: newId,
          plan: "free",
          status: "active",
        });
      }
    } else if (lineUserId && !profile.line_user_id) {
      await supabase.from("profiles").update({ line_user_id: lineUserId }).eq("id", profile.id);
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const parsed = state ? verifyMobileState(state) : null;
  if (!parsed) {
    logger.error("[Mobile Callback] Invalid or expired state");
    return new NextResponse("Invalid state", { status: 400 });
  }

  const appRedirect = parsed.r;
  const appState = parsed.st;
  const provider = parsed.p;

  if (oauthError) {
    logger.error("[Mobile Callback] OAuth error:", oauthError);
    return redirectToApp(appRedirect, { error: oauthError, state: appState });
  }
  if (!code) {
    return redirectToApp(appRedirect, { error: "missing_code", state: appState });
  }

  try {
    const issuer = auth0IssuerBaseUrl();

    // Auth0 の code を token に交換（confidential client なので client_secret を使用）
    const tokenRes = await fetch(`${issuer}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.AUTH0_CLIENT_ID!,
        client_secret: process.env.AUTH0_CLIENT_SECRET!,
        code,
        redirect_uri: `${siteBase()}/api/auth/${provider}/mobile/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      logger.error("[Mobile Callback] Token exchange failed:", tokenRes.status, t);
      return redirectToApp(appRedirect, { error: "token_exchange_failed", state: appState });
    }

    const tokens = await tokenRes.json();
    const accessToken: string | undefined = tokens.access_token;
    if (!accessToken) {
      return redirectToApp(appRedirect, { error: "no_access_token", state: appState });
    }

    // userinfo でプロフィールを取得し、profile/subscription を用意する
    const userRes = await fetch(`${issuer}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      logger.error("[Mobile Callback] userinfo failed:", userRes.status);
      return redirectToApp(appRedirect, { error: "userinfo_failed", state: appState });
    }
    const userInfo: Auth0UserInfo = await userRes.json();
    logger.log("[Mobile Callback] Login:", maskEmail(userInfo.email), maskId(userInfo.sub));

    await upsertProfile(userInfo);

    // access_token をアプリへ返す（アプリは Keychain に保存し /api/auth/me で検証）
    return redirectToApp(appRedirect, { token: accessToken, state: appState });
  } catch (error) {
    logger.error("[Mobile Callback] Unexpected error:", error);
    return redirectToApp(appRedirect, { error: "unknown_error", state: appState });
  }
}
