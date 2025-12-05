import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  // Handle magic link (from LINE login)
  if (token_hash && type === "magiclink") {
    console.log("[Auth Callback] Verifying magic link...");
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "magiclink",
    });
    if (!error) {
      console.log("[Auth Callback] Magic link verified");
      return await redirectBasedOnProfile(supabase, origin);
    }
    console.error("[Auth Callback] Magic link verification failed:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  // Handle OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return await redirectBasedOnProfile(supabase, origin);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

// Check if profile is complete and redirect accordingly
async function redirectBasedOnProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string
): Promise<NextResponse> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Check if profile exists and is complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("email, display_name")
    .eq("id", user.id)
    .single();

  const profileData = profile as { email: string | null; display_name: string | null } | null;

  // If profile is incomplete or has placeholder email, redirect to onboarding
  const needsOnboarding =
    !profileData ||
    !profileData.email ||
    !profileData.display_name ||
    profileData.email.endsWith("@line.local");

  if (needsOnboarding) {
    console.log("[Auth Callback] Profile incomplete, redirecting to onboarding");
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  console.log("[Auth Callback] Profile complete, redirecting to dashboard");
  return NextResponse.redirect(`${origin}/dashboard`);
}
