import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  console.log("[LINE Callback] Received callback");
  console.log("[LINE Callback] Code:", code ? "present" : "missing");
  console.log("[LINE Callback] State:", state ? "present" : "missing");
  console.log("[LINE Callback] Error:", error);
  console.log("[LINE Callback] Error Description:", errorDescription);

  // Handle errors from LINE
  if (error) {
    console.error("[LINE Callback] OAuth error:", error, errorDescription);
    return NextResponse.redirect(`${siteUrl}login?error=line_auth_failed`);
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("line_oauth_state")?.value;

  console.log("[LINE Callback] Stored state:", storedState ? "present" : "missing");
  console.log("[LINE Callback] State match:", state === storedState);

  if (!state || state !== storedState) {
    console.error("[LINE Callback] State mismatch - received:", state, "stored:", storedState);
    return NextResponse.redirect(`${siteUrl}login?error=invalid_state`);
  }

  // Clear state cookie
  cookieStore.delete("line_oauth_state");

  if (!code) {
    return NextResponse.redirect(`${siteUrl}login?error=no_code`);
  }

  try {
    // Exchange code for access token
    console.log("[LINE Callback] Exchanging code for token...");
    console.log("[LINE Callback] Channel ID set:", !!process.env.LINE_LOGIN_CHANNEL_ID);
    console.log("[LINE Callback] Channel Secret set:", !!process.env.LINE_LOGIN_CHANNEL_SECRET);

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
    console.log("[LINE Callback] Token exchange successful");

    // Get user profile
    console.log("[LINE Callback] Fetching user profile...");
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
    console.log("[LINE Callback] Profile fetched:", profile.displayName, profile.userId);

    // Create or get user in Supabase
    const supabase = createAdminClient();

    // Check if user exists with this LINE ID
    console.log("[LINE Callback] Checking for existing user...");
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", profile.userId)
      .single();

    console.log("[LINE Callback] Existing profile:", existingProfile, "Error:", profileError?.message);

    let userId: string;

    if (existingProfile) {
      // User exists, get their auth user
      userId = existingProfile.id;
      console.log("[LINE Callback] Existing user found:", userId);
    } else {
      // Create new user with LINE info
      console.log("[LINE Callback] Creating new user...");
      const email = `line_${profile.userId}@line.local`;
      const password = `line_${profile.userId}_${Date.now()}_${Math.random().toString(36)}`;

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
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
      console.log("[LINE Callback] User created:", userId);

      // Update profile with LINE ID
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          line_user_id: profile.userId,
          display_name: profile.displayName,
        })
        .eq("id", userId);

      console.log("[LINE Callback] Profile update error:", updateError?.message);
    }

    // Create a session for the user
    // Generate a magic link token and sign in
    console.log("[LINE Callback] Generating magic link...");
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: `line_${profile.userId}@line.local`,
    });

    if (sessionError || !sessionData) {
      console.error("[LINE Callback] Session creation failed:", sessionError);
      return NextResponse.redirect(`${siteUrl}login?error=session_failed`);
    }

    console.log("[LINE Callback] Magic link generated, hashed_token:", !!sessionData.properties?.hashed_token);

    // Redirect to the magic link which will set the session
    const redirectUrl = sessionData.properties?.hashed_token
      ? `${siteUrl}auth/callback?token_hash=${sessionData.properties.hashed_token}&type=magiclink`
      : `${siteUrl}dashboard`;

    console.log("[LINE Callback] Redirecting to:", redirectUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[LINE Callback] Unexpected error:", error);
    return NextResponse.redirect(`${siteUrl}login?error=unknown_error`);
  }
}
