import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHmac } from "crypto";
import { logger } from "@/lib/logger";

// アプリの provider 名 -> Auth0 の connection 名
const CONNECTION: Record<string, string> = {
  google: "google-oauth2",
  line: "line",
};

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

// アプリのカスタムスキーム(redirect_uri)と state を署名付きで Auth0 の state に載せる。
// これで callback 側は改ざんされていないことを検証してからアプリへ戻せる。
function signMobileState(payload: { r: string; st: string; p: string }): string {
  const secret = process.env.AUTH0_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const body = { ...payload, ts: Date.now(), n: randomBytes(8).toString("hex") };
  const sig = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return Buffer.from(JSON.stringify({ ...body, s: sig })).toString("base64url");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const connection = CONNECTION[provider];
  if (!connection) {
    return new NextResponse("Unsupported provider", { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const appRedirect = searchParams.get("redirect_uri"); // meishikanri://auth/callback
  const appState = searchParams.get("state") ?? "";

  // カスタムスキーム以外は拒否（オープンリダイレクト対策）
  if (!appRedirect || !appRedirect.startsWith("meishikanri://")) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }

  const issuer = process.env.AUTH0_ISSUER_BASE_URL!;
  const clientId = process.env.AUTH0_CLIENT_ID!;
  const state = signMobileState({ r: appRedirect, st: appState, p: provider });
  const callback = `${siteBase()}/api/auth/${provider}/mobile/callback`;

  logger.log("[Mobile Auth] Starting flow for provider:", provider, "connection:", connection);

  const authorize = new URL(`${issuer}/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("connection", connection);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);

  return NextResponse.redirect(authorize.toString());
}
