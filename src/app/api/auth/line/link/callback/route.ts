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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  // Handle errors from LINE
  if (error) {
    console.error("LINE OAuth error:", error);
    return NextResponse.redirect(`${siteUrl}settings?error=line_auth_failed`);
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("line_link_state")?.value;

  if (!state || state !== storedState) {
    console.error("State mismatch");
    return NextResponse.redirect(`${siteUrl}settings?error=invalid_state`);
  }

  // Extract user ID from state
  const stateMatch = state.match(/^link_([^_]+)_/);
  if (!stateMatch) {
    return NextResponse.redirect(`${siteUrl}settings?error=invalid_state`);
  }
  const userId = stateMatch[1];

  // Clear state cookie
  cookieStore.delete("line_link_state");

  if (!code) {
    return NextResponse.redirect(`${siteUrl}settings?error=no_code`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${siteUrl}api/auth/line/link/callback`,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(`${siteUrl}settings?error=token_exchange_failed`);
    }

    const tokenData: LineTokenResponse = await tokenResponse.json();

    // Get user profile
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error("Profile fetch failed");
      return NextResponse.redirect(`${siteUrl}settings?error=profile_fetch_failed`);
    }

    const profile: LineProfile = await profileResponse.json();

    // Update user's profile with LINE ID
    const supabase = createAdminClient();

    // Check if this LINE ID is already linked to another account
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", profile.userId)
      .single();

    if (existingProfile && existingProfile.id !== userId) {
      return NextResponse.redirect(`${siteUrl}settings?error=line_already_linked`);
    }

    // Update the user's profile with LINE ID
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        line_user_id: profile.userId,
        display_name: profile.displayName,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update failed:", updateError);
      return NextResponse.redirect(`${siteUrl}settings?error=update_failed`);
    }

    return NextResponse.redirect(`${siteUrl}settings?success=line_linked`);
  } catch (error) {
    console.error("LINE link error:", error);
    return NextResponse.redirect(`${siteUrl}settings?error=unknown_error`);
  }
}
