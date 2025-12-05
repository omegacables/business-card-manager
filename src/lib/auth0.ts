import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

    const email = session?.user?.email;
    const authSub = session?.user?.sub;
    const lineUserId = authSub?.startsWith("line|") ? authSub.replace("line|", "") : null;

    console.log("[Auth0 Callback] Email:", email);
    console.log("[Auth0 Callback] LINE user ID:", lineUserId);

    try {
      const supabase = createAdminClient();

      if (!email && lineUserId) {
        // LINE user without email - check if they have a profile by LINE ID
        console.log("[Auth0 Callback] LINE user without email, checking for existing profile");

        const { data: lineProfile } = await supabase
          .from("profiles")
          .select("id, email, line_user_id")
          .eq("line_user_id", lineUserId)
          .single();

        if (lineProfile && lineProfile.email) {
          // Has profile with email set, go to dashboard
          console.log("[Auth0 Callback] Found profile with email, redirecting to dashboard");
          return NextResponse.redirect(new URL("/dashboard", baseUrl));
        }

        // No profile or no email - redirect to settings to set email
        console.log("[Auth0 Callback] No email set, redirecting to settings");
        return NextResponse.redirect(new URL("/settings?setup=email", baseUrl));
      }

      if (email) {
        // User has email, check/create profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, line_user_id")
          .eq("email", email)
          .single();

        console.log("[Auth0 Callback] Existing profile:", profile);

        if (!profile) {
          // Create profile with generated UUID
          console.log("[Auth0 Callback] Creating new profile for:", email);
          const newId = randomUUID();
          const { error: insertError } = await supabase.from("profiles").insert({
            id: newId,
            email: email,
            display_name: session?.user?.name || null,
            line_user_id: lineUserId,
          });

          if (insertError) {
            console.error("[Auth0 Callback] Profile insert error:", JSON.stringify(insertError));
          } else {
            // Also create subscription
            await supabase.from("subscriptions").insert({
              user_id: newId,
              plan: "free",
              status: "active",
            });
          }
        } else if (lineUserId && !profile.line_user_id) {
          // Link LINE to existing profile
          console.log("[Auth0 Callback] Linking LINE to existing profile");
          await supabase
            .from("profiles")
            .update({ line_user_id: lineUserId })
            .eq("id", profile.id);
        }
      }

      console.log("[Auth0 Callback] Redirecting to dashboard");
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    } catch (err) {
      console.error("[Auth0 Callback] Unexpected error:", err);
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    }
  },
});
