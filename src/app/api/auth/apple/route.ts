import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, createPublicKey, verify as cryptoVerify } from "crypto";
import { logger, maskEmail, maskId } from "@/lib/logger";

/**
 * POST /api/auth/apple
 *
 * iOSネイティブの Sign in with Apple の identityToken を検証し、
 * Supabase の access_token を返す（LINEネイティブと同じ扱い）。
 *
 * 以前は supabase.auth.signInWithIdToken に依存していたが、
 * それには Supabase ダッシュボードの Apple プロバイダ設定
 * （Client IDs に実機のBundle IDを登録）が必要で、
 * 実機ビルドではBundle IDにサフィックスが付くため aud 不一致で失敗していた。
 * ここでは Apple の公開鍵(JWKS)で自前検証し、aud は
 * ベースBundle IDの前方一致で許可する（サフィックス付きにも対応）。
 */

// このアプリのベースBundle ID（実機再署名では `.xxxx.yyyy` が付く）
const BASE_BUNDLE_ID = "app.rork.tyl7sdawrtvvc61p9zjd0";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

interface AppleJwk {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  nonce?: string;
}

// Appleの公開鍵をプロセス内で短時間キャッシュ
let jwksCache: { keys: AppleJwk[]; expiresAt: number } | null = null;

async function fetchAppleJwks(): Promise<AppleJwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: AppleJwk[] };
  jwksCache = { keys: body.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return body.keys;
}

function base64UrlToJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

/**
 * Apple の identityToken(JWT) を検証してペイロードを返す。
 * 署名・iss・exp・aud（ベースBundle IDの前方一致）・nonce を確認する。
 */
async function verifyAppleIdentityToken(
  identityToken: string,
  rawNonce: string | undefined
): Promise<AppleTokenPayload | null> {
  const segments = identityToken.split(".");
  if (segments.length !== 3) return null;

  const header = base64UrlToJson<{ kid?: string; alg?: string }>(segments[0]);
  const payload = base64UrlToJson<AppleTokenPayload>(segments[1]);

  if (header.alg !== "RS256" || !header.kid) return null;

  const keys = await fetchAppleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // 鍵ローテーション直後の可能性 — キャッシュを捨てて1回だけ再取得
    jwksCache = null;
    const fresh = await fetchAppleJwks();
    const retry = fresh.find((k) => k.kid === header.kid);
    if (!retry) return null;
    return verifyWithJwk(identityToken, retry, payload, rawNonce);
  }
  return verifyWithJwk(identityToken, jwk, payload, rawNonce);
}

function verifyWithJwk(
  identityToken: string,
  jwk: AppleJwk,
  payload: AppleTokenPayload,
  rawNonce: string | undefined
): AppleTokenPayload | null {
  const [headerB64, payloadB64, signatureB64] = identityToken.split(".");

  const publicKey = createPublicKey({
    key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
    format: "jwk",
  });
  const isValid = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, "base64url")
  );
  if (!isValid) {
    logger.error("[Apple] Signature verification failed");
    return null;
  }

  if (payload.iss !== APPLE_ISSUER) {
    logger.error("[Apple] Invalid issuer:", payload.iss);
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    logger.error("[Apple] Token expired");
    return null;
  }

  // aud はベースBundle IDの前方一致で許可（実機再署名のサフィックス付きに対応）
  const allowedBase = process.env.APPLE_BUNDLE_ID || BASE_BUNDLE_ID;
  if (payload.aud !== allowedBase && !payload.aud.startsWith(`${allowedBase}.`)) {
    logger.error("[Apple] Audience mismatch:", payload.aud);
    return null;
  }

  // nonce 検証: トークンには 生nonce の SHA256 が入っている（アプリは生nonceを送る）
  if (payload.nonce && rawNonce) {
    const hashed = createHash("sha256").update(rawNonce).digest("hex");
    if (payload.nonce !== hashed && payload.nonce !== rawNonce) {
      logger.error("[Apple] Nonce mismatch");
      return null;
    }
  }

  return payload;
}

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Appleユーザー用の決定的パスワード（LINEネイティブと同じ方式）
function generateApplePassword(appleUserId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createHash("sha256")
    .update(`apple_${appleUserId}_${secret}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const identityToken =
    (body.identityToken as string) || (body.id_token as string) || (body.token as string);
  const nonce = typeof body.nonce === "string" ? body.nonce : undefined;
  // 初回サインイン時のみアプリから渡される表示名
  const fullName = typeof body.fullName === "string" ? body.fullName : null;

  if (!identityToken) {
    return NextResponse.json({ error: "missing_identity_token" }, { status: 400 });
  }

  try {
    // 1) Apple の identityToken を自前検証
    const verified = await verifyAppleIdentityToken(identityToken, nonce);
    if (!verified?.sub) {
      return NextResponse.json({ error: "apple_auth_failed" }, { status: 401 });
    }

    const appleUserId = verified.sub;
    const email = verified.email ?? `apple_${appleUserId}@apple.local`;
    logger.log("[Apple] Verified:", maskId(appleUserId), maskEmail(email));

    // 2) Supabaseユーザーを作成 or 検索（LINEネイティブと同じ構造）
    const supabase = createAdminClient();
    const userPassword = generateApplePassword(appleUserId);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        apple_user_id: appleUserId,
        ...(fullName ? { display_name: fullName } : {}),
      },
    });

    if (created?.user && fullName) {
      await supabase
        .from("profiles")
        .update({ display_name: fullName })
        .eq("id", created.user.id);
    } else if (createError) {
      // 既存アカウント（Web登録済み等）の可能性 — 下のフォールバックで続行
      logger.log("[Apple] createUser skipped:", createError.message);
    }

    // 3) セッションを作成して access_token を返す
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    let session = null;

    // 新規作成したユーザー、またはApple作成済みユーザーはパスワードで入れる
    const { data: pwData } = await anonClient.auth.signInWithPassword({
      email,
      password: userPassword,
    });
    session = pwData?.session ?? null;

    // 既存のメールアカウント（パスワードを上書きしてはいけない）は
    // サーバー側でマジックリンクを発行して即時検証しセッションを得る
    if (!session) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (linkError || !tokenHash) {
        logger.error("[Apple] generateLink failed:", linkError?.message);
      } else {
        const { data: otpData } = await anonClient.auth.verifyOtp({
          type: "email",
          token_hash: tokenHash,
        });
        session = otpData?.session ?? null;
      }
    }

    if (!session) {
      return NextResponse.json({ error: "session_creation_failed" }, { status: 500 });
    }

    // メタデータにApple IDを記録（既存アカウントとの紐付け用）
    const currentMeta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    if (currentMeta.apple_user_id !== appleUserId) {
      await supabase.auth.admin.updateUserById(session.user.id, {
        user_metadata: { ...currentMeta, apple_user_id: appleUserId },
      });
    }

    logger.log("[Apple] Login success:", maskId(session.user.id));

    return NextResponse.json({
      token: session.access_token,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (e) {
    logger.error("[Apple] Unexpected error:", e);
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}
