import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // Handle magic link (from LINE login)
  if (token_hash && type === "magiclink") {
    console.log("[Auth Callback] Verifying magic link...");
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "magiclink",
    });
    if (!error) {
      console.log("[Auth Callback] Magic link verified, redirecting to dashboard");
      return NextResponse.redirect(`${origin}/dashboard`);
    }
    console.error("[Auth Callback] Magic link verification failed:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  // Handle OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
