import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { logger, maskId } from "@/lib/logger";

/**
 * POST /api/auth/line/native
 * ネイティブLINEログイン(iOS SDK)のトークン交換。
 * IDトークンをLINEサーバーで検証し、Supabaseユーザーを検索/作成して
 * Supabaseアクセストークンを返す。
 */

const NATIVE_LINE_CHANNEL_ID = "2008633657";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Web版コールバックと同一ロジックの決定論的パスワード
function generateLinePassword(lineUserId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createHash("sha256")
    .update(`line_${lineUserId}_${secret}`)
    .digest("hex");
}

interface VerifiedIdToken {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
}

async function verifyLineIdToken(idToken: string): Promise<VerifiedIdToken | null> {
  const candidates = Array.from(
    new Set(
      [process.env.LINE_LOGIN_CHANNEL_ID, NATIVE_LINE_CHANNEL_ID].filter(
        (v): v is string => !!v
      )
    )
  );

  for (const clientId of candidates) {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    });
    if (res.ok) {
      return (await res.json()) as VerifiedIdToken;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      idToken?: unknown;
      accessToken?: unknown;
    } | null;

    const idToken = typeof body?.idToken === "string" ? body.idToken : null;
    const accessToken =
      typeof body?.accessToken === "string" ? body.accessToken : null;

    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }

    const verified = await verifyLineIdToken(idToken);
    if (!verified?.sub) {
      logger.error("[LINE Native] ID token verification failed");
      return NextResponse.json(
        { error: "LINEの認証情報を検証できませんでした。もう一度お試しください。" },
        { status: 401 }
      );
    }

    const lineUserId = verified.sub;
    let displayName: string | null = verified.name ?? null;
    let pictureUrl: string | null = verified.picture ?? null;

    if ((!displayName || !pictureUrl) && accessToken) {
      const profileRes = await fetch("https://api.line.me/v2/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const p = (await profileRes.json()) as {
          displayName?: string;
          pictureUrl?: string;
        };
        displayName = displayName ?? p.displayName ?? null;
        pictureUrl = pictureUrl ?? p.pictureUrl ?? null;
      }
    }

    logger.log("[LINE Native] Verified LINE user:", maskId(lineUserId));

    const supabase = createAdminClient();
    const userPassword = generateLinePassword(lineUserId);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();

    let userEmail = `line_${lineUserId}@line.local`;
    let isNewUser = false;

    if (existingProfile) {
      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(existingProfile.id);

      if (userError || !userData.user) {
        logger.error("[LINE Native] Failed to load user:", userError?.message);
        return NextResponse.json(
          { error: "ユーザー情報の取得に失敗しました。" },
          { status: 500 }
        );
      }

      userEmail = userData.user.email ?? userEmail;

      if (userEmail.endsWith("@line.local")) {
        await supabase.auth.admin.updateUserById(existingProfile.id, {
          password: userPassword,
        });
      }
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: userEmail,
          password: userPassword,
          email_confirm: true,
          user_metadata: {
            display_name: displayName,
            avatar_url: pictureUrl,
            line_user_id: lineUserId,
          },
        });

      if (authData?.user) {
        isNewUser = true;
        await supabase
          .from("profiles")
          .update({
            line_user_id: lineUserId,
            ...(displayName ? { display_name: displayName } : {}),
          })
          .eq("id", authData.user.id);
      } else {
        logger.log(
          "[LINE Native] createUser failed, trying existing account:",
          authError?.message
        );
      }
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    let session = null;

    const { data: pwData } = await anonClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    session = pwData?.session ?? null;

    // メール連携済みアカウント等、パスワードを上書きできないユーザー向けフォールバック
    if (!session) {
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
        });

      const tokenHash = linkData?.properties?.hashed_token;
      if (linkError || !tokenHash) {
        logger.error("[LINE Native] generateLink failed:", linkError?.message);
      } else {
        const { data: otpData } = await anonClient.auth.verifyOtp({
          type: "email",
          token_hash: tokenHash,
        });
        session = otpData?.session ?? null;
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: "セッションの作成に失敗しました。時間をおいて再度お試しください。" },
        { status: 500 }
      );
    }

    if (!existingProfile && !isNewUser) {
      await supabase
        .from("profiles")
        .update({
          line_user_id: lineUserId,
          ...(displayName ? { display_name: displayName } : {}),
        })
        .eq("id", session.user.id);
    }

    logger.log("[LINE Native] Sign in successful:", maskId(session.user.id));

    return NextResponse.json({
      token: session.access_token,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (error) {
    logger.error("[LINE Native] Unexpected error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
