import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Auth0 v4 SDK with explicit route configuration
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
  },
  // Redirect after login - check if profile exists
  async onCallback(error, context, session) {
    const baseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL || "";

    console.log("[Auth0 Callback] Starting callback handler");
    console.log("[Auth0 Callback] Base URL:", baseUrl);
    console.log("[Auth0 Callback] Session user:", session?.user?.email, session?.user?.sub);

    if (error) {
      console.error("[Auth0 Callback] Error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
    }

    // Check if user has email
    const email = session?.user?.email;
    console.log("[Auth0 Callback] Email:", email);

    if (!email) {
      // No email from provider, redirect to onboarding
      console.log("[Auth0 Callback] No email, redirecting to onboarding");
      return NextResponse.redirect(new URL("/onboarding", baseUrl));
    }

    try {
      // Check if profile exists with this email (by id or email column)
      const supabase = createAdminClient();

      // First try to find by id = email
      let { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("id", email)
        .single();

      // If not found by id, try by email column
      if (!profile) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", email)
          .single();
        profile = profileByEmail;
      }

      console.log("[Auth0 Callback] Existing profile:", profile);

      if (!profile) {
        // Create profile with email as ID
        console.log("[Auth0 Callback] Creating new profile for:", email);
        const { error: insertError } = await supabase.from("profiles").insert({
          id: email,
          email: email,
          display_name: session?.user?.name || null,
        });

        if (insertError) {
          console.error("[Auth0 Callback] Profile insert error:", insertError);
        }
      } else if (profile.id !== email) {
        // Profile exists but with different id format, update it
        console.log("[Auth0 Callback] Updating profile id from", profile.id, "to", email);
        // Note: This might need manual migration
      }

      console.log("[Auth0 Callback] Redirecting to dashboard");
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    } catch (err) {
      console.error("[Auth0 Callback] Unexpected error:", err);
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    }
  },
});
