import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger, maskEmail } from "@/lib/logger";

// Apple の idトークンを Supabase セッションに交換するための anon クライアント
function createAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// iOSネイティブの Sign in with Apple から受け取った idトークンを検証し、
// Supabase の access_token を返す。アプリはこの token を保存して /api/auth/me で検証する
// （Google/LINE と同じ扱い。profile 作成は /api/auth/me 側で行われる）。
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // expo-apple-authentication は credential.identityToken を返す。別名も許容。
  const identityToken =
    (body.identityToken as string) || (body.id_token as string) || (body.token as string);
  const nonce = body.nonce as string | undefined; // 生nonce（アプリが使っていれば）

  if (!identityToken) {
    return NextResponse.json({ error: "missing_identity_token" }, { status: 400 });
  }

  try {
    const supabase = createAuthClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
      ...(nonce ? { nonce } : {}),
    });

    if (error || !data.session?.access_token || !data.user) {
      logger.error("[Apple] signInWithIdToken failed:", error?.message);
      return NextResponse.json({ error: "apple_auth_failed" }, { status: 401 });
    }

    logger.log("[Apple] Login success:", maskEmail(data.user.email));

    // アプリは token を Keychain/SecureStore に保存 → /api/auth/me（Bearer）で検証
    return NextResponse.json({ token: data.session.access_token });
  } catch (e) {
    logger.error("[Apple] Unexpected error:", e);
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}
