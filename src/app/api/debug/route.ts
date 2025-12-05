import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const userEmail = session.user.email;
    const userSub = session.user.sub;
    const lineUserId = userSub?.startsWith("line|") ? userSub.replace("line|", "") : null;

    // Look up profile by email
    let profileByEmail = null;
    let emailError = null;
    if (userEmail) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", userEmail)
        .single();
      profileByEmail = data;
      emailError = error?.message;
    }

    // Look up profile by LINE ID
    let profileByLine = null;
    let lineError = null;
    if (lineUserId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("line_user_id", lineUserId)
        .single();
      profileByLine = data;
      lineError = error?.message;
    }

    const profile = profileByEmail || profileByLine;

    // Get sample business cards
    const { data: sampleCards } = await supabase
      .from("business_cards")
      .select("id, name, user_id")
      .limit(5);

    // If profile found, get cards for this user
    let userCards = null;
    if (profile) {
      const { data } = await supabase
        .from("business_cards")
        .select("id, name, user_id")
        .eq("user_id", profile.id)
        .limit(5);
      userCards = data;
    }

    return NextResponse.json({
      session: {
        email: userEmail,
        sub: userSub,
        lineUserId,
        name: session.user.name,
      },
      profileLookup: {
        byEmail: {
          found: !!profileByEmail,
          profile: profileByEmail,
          error: emailError,
        },
        byLine: {
          found: !!profileByLine,
          profile: profileByLine,
          error: lineError,
        },
      },
      finalProfile: profile,
      sampleCardsInDB: sampleCards,
      userCards: userCards,
      match: profile && sampleCards?.some(c => c.user_id === profile.id),
    });
  } catch (error) {
    return NextResponse.json({
      error: "Internal error",
      details: String(error)
    }, { status: 500 });
  }
}
