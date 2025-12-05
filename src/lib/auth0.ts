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
    if (error) {
      console.error("Auth0 callback error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
    }

    // Check if user has email
    const email = session?.user?.email;
    if (!email) {
      // No email from provider, redirect to onboarding
      return NextResponse.redirect(new URL("/onboarding", baseUrl));
    }

    // Check if profile exists with this email
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (!profile) {
      // Create profile with email as ID
      await supabase.from("profiles").insert({
        id: email,
        email: email,
        display_name: session?.user?.name || null,
      });
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", baseUrl));
  },
});
