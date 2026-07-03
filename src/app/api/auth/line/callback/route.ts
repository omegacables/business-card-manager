import { logger, maskEmail, maskId } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "crypto";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Generate deterministic password for LINE users
function generateLinePassword(lineUserId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createHash("sha256")
    .update(`line_${lineUserId}_${secret}`)
    .digest("hex");
}

// Verify signed state token (Base64 URL-safe encoded)
function verifySignedLoginState(state: string): boolean {
  try {
    // Decode Base64 URL-safe
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const stateData = JSON.parse(decoded);

    if (stateData.t !== "login") {
      return false;
    }

    const { t, ts, n, s } = stateData;
    const payload = JSON.stringify({ t, ts, n });
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);

    // Check signature
    if (s !== expectedSignature) {
      console.error("[LINE Callback] Invalid signature");
      return false;
    }

    // Check timestamp (10 minutes expiry)
    const stateTime = parseInt(ts, 10);
    const now = Date.now();
    if (now - stateTime > 10 * 60 * 1000) {
      console.error("[LINE Callback] State expired");
      return false;
    }

    return true;
  } catch (e) {
    console.error("[LINE Callback] State verification error:", e);
    return false;
  }
}

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
}

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const cookieStore = await cookies();

  logger.log("[LINE Callback] Received callback");
  logger.log("[LINE Callback] Code:", code ? "present" : "missing");
  logger.log("[LINE Callback] State:", state ? "present" : "missing");
  logger.log("[LINE Callback] Error:", error);

  // Handle errors from LINE
  if (error) {
    console.error("[LINE Callback] OAuth error:", error, errorDescription);
    return NextResponse.redirect(`${siteUrl}login?error=line_auth_failed`);
  }

  // Verify signed state token (no cookies needed!)
  if (!state || !verifySignedLoginState(state)) {
    console.error("[LINE Callback] Invalid or expired state");
    return NextResponse.redirect(`${siteUrl}login?error=invalid_state`);
  }

  logger.log("[LINE Callback] State verified successfully");

  if (!code) {
    return NextResponse.redirect(`${siteUrl}login?error=no_code`);
  }

  try {
    // Exchange code for access token
    logger.log("[LINE Callback] Exchanging code for token...");
    logger.log("[LINE Callback] Channel ID set:", !!process.env.LINE_LOGIN_CHANNEL_ID);
    logger.log("[LINE Callback] Channel Secret set:", !!process.env.LINE_LOGIN_CHANNEL_SECRET);

    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${siteUrl}api/auth/line/callback`,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[LINE Callback] Token exchange failed:", tokenResponse.status, errorText);
      return NextResponse.redirect(`${siteUrl}login?error=token_exchange_failed`);
    }

    const tokenData: LineTokenResponse = await tokenResponse.json();
    logger.log("[LINE Callback] Token exchange successful");

    // Get user profile
    logger.log("[LINE Callback] Fetching user profile...");
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("[LINE Callback] Profile fetch failed:", profileResponse.status, errorText);
      return NextResponse.redirect(`${siteUrl}login?error=profile_fetch_failed`);
    }

    const profile: LineProfile = await profileResponse.json();
    logger.log("[LINE Callback] Profile fetched:", maskId(profile.userId));

    // Create or get user in Supabase
    const supabase = createAdminClient();

    // Check if user exists with this LINE ID
    logger.log("[LINE Callback] Checking for existing user...");
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", profile.userId)
      .single();

    logger.log("[LINE Callback] Existing profile:", maskId(existingProfile?.id), "Error:", profileError?.message);

    const userPassword = generateLinePassword(profile.userId);

    let userId: string;
    let userEmail: string;

    if (existingProfile) {
      // User exists with this LINE ID - get their actual email
      userId = existingProfile.id;
      logger.log("[LINE Callback] Existing user found:", maskId(userId));

      // Get the user's actual email from auth.users
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData.user) {
        console.error("[LINE Callback] Failed to get user:", userError);
        return NextResponse.redirect(`${siteUrl}login?error=user_creation_failed`);
      }

      userEmail = userData.user.email!;
      logger.log("[LINE Callback] User email:", maskEmail(userEmail));

      // Only update password for LINE-created users (don't overwrite email users' passwords)
      if (userEmail.endsWith("@line.local")) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password: userPassword,
        });

        if (updateError) {
          console.error("[LINE Callback] Password update failed:", updateError);
        }
      }
    } else {
      // Create new user with LINE info and deterministic password
      logger.log("[LINE Callback] Creating new user...");
      userEmail = `line_${profile.userId}@line.local`;

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          display_name: profile.displayName,
          avatar_url: profile.pictureUrl,
          line_user_id: profile.userId,
        },
      });

      if (authError || !authData.user) {
        console.error("[LINE Callback] User creation failed:", authError);
        return NextResponse.redirect(`${siteUrl}login?error=user_creation_failed`);
      }

      userId = authData.user.id;
      logger.log("[LINE Callback] User created:", maskId(userId));

      // Update profile with LINE ID
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          line_user_id: profile.userId,
          display_name: profile.displayName,
        })
        .eq("id", userId);

      if (updateError) {
        logger.log("[LINE Callback] Profile update error:", updateError.message);
      }
    }

    // Sign in the user with password using SSR client
    logger.log("[LINE Callback] Signing in user...");

    const { createServerClient } = await import("@supabase/ssr");

    // Check if profile is complete to determine redirect destination
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", userId)
      .single();

    const needsOnboarding =
      !profileData ||
      !profileData.email ||
      !profileData.display_name ||
      profileData.email.endsWith("@line.local");

    const redirectUrl = needsOnboarding ? `${siteUrl}onboarding` : `${siteUrl}dashboard`;

    // Prepare response for setting cookies
    const response = NextResponse.redirect(redirectUrl);

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });

    if (signInError || !signInData.session) {
      console.error("[LINE Callback] Sign in failed:", signInError);
      return NextResponse.redirect(`${siteUrl}login?error=session_failed`);
    }

    logger.log("[LINE Callback] Sign in successful, redirecting to dashboard");
    return response;
  } catch (error) {
    console.error("[LINE Callback] Unexpected error:", error);
    return NextResponse.redirect(`${siteUrl}login?error=unknown_error`);
  }
}
