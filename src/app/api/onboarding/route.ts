import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const authSub = session.user.sub;
    const authName = session.user.name;

    const body = await request.json();
    const { email, display_name } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log("[Onboarding] Auth sub:", authSub);
    console.log("[Onboarding] Submitted email:", email);

    const supabase = createAdminClient();

    // Check if this email is already used by another profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, line_user_id, display_name")
      .eq("email", email)
      .single();

    if (existingProfile) {
      // Profile with this email already exists
      // Check if it's linked to LINE
      if (existingProfile.line_user_id) {
        // Already has LINE linked, this is a duplicate
        return NextResponse.json({ error: "email_exists" }, { status: 409 });
      }

      // Profile exists but no LINE - link this LINE account to it
      console.log("[Onboarding] Linking LINE to existing profile:", email, "profile id:", existingProfile.id);

      // Extract LINE user ID from auth sub (format: line|Uxxxxxx)
      const lineUserId = authSub.startsWith("line|") ? authSub.replace("line|", "") : null;

      if (lineUserId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            line_user_id: lineUserId,
            display_name: display_name || existingProfile.display_name || authName,
          })
          .eq("id", existingProfile.id);

        if (updateError) {
          console.error("[Onboarding] Update error:", JSON.stringify(updateError));
          return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, linked: true });
    }

    // No existing profile - create new one
    console.log("[Onboarding] Creating new profile for:", email);

    // Extract LINE user ID from auth sub
    const lineUserId = authSub.startsWith("line|") ? authSub.replace("line|", "") : null;
    const newId = randomUUID();

    const { error: insertError } = await supabase.from("profiles").insert({
      id: newId,
      email: email,
      display_name: display_name || authName,
      line_user_id: lineUserId,
    });

    if (insertError) {
      console.error("[Onboarding] Insert error:", JSON.stringify(insertError));
      // Check if it's a unique constraint error
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "email_exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    // Also create default subscription
    await supabase.from("subscriptions").insert({
      user_id: newId,
      plan: "free",
      status: "active",
    });

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error("[Onboarding] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
