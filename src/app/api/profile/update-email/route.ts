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
    const currentAuthEmail = session.user.email;

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    console.log("[UpdateEmail] Auth sub:", authSub);
    console.log("[UpdateEmail] Current auth email:", currentAuthEmail);
    console.log("[UpdateEmail] New email:", email);

    const supabase = createAdminClient();

    // Check if the new email is already used by another profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, line_user_id")
      .eq("email", email)
      .single();

    // Extract LINE user ID if this is a LINE user
    const lineUserId = authSub.startsWith("line|") ? authSub.replace("line|", "") : null;

    console.log("[UpdateEmail] LINE user ID:", lineUserId);
    console.log("[UpdateEmail] Existing profile:", existingProfile);

    // If email already exists in a profile
    if (existingProfile) {
      // Case 1: This LINE user is already linked to this profile
      if (lineUserId && existingProfile.line_user_id === lineUserId) {
        console.log("[UpdateEmail] Already linked to this profile");
        return NextResponse.json({ success: true, unchanged: true });
      }

      // Case 2: Profile has a different LINE user linked - reject
      if (existingProfile.line_user_id && lineUserId && existingProfile.line_user_id !== lineUserId) {
        console.log("[UpdateEmail] Profile has different LINE user linked");
        return NextResponse.json({ error: "email_exists" }, { status: 409 });
      }

      // Case 3: Profile has no LINE linked and current user is LINE user - link them!
      if (!existingProfile.line_user_id && lineUserId) {
        console.log("[UpdateEmail] Linking LINE to existing profile:", email, "profile id:", existingProfile.id);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ line_user_id: lineUserId })
          .eq("id", existingProfile.id);

        if (updateError) {
          console.error("[UpdateEmail] Link error:", JSON.stringify(updateError));
          return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
        }

        return NextResponse.json({ success: true, linked: true });
      }

      // Case 4: Same email as auth email - no change needed
      if (currentAuthEmail && existingProfile.email === currentAuthEmail) {
        console.log("[UpdateEmail] Same as current auth email");
        return NextResponse.json({ success: true, unchanged: true });
      }

      // Other cases - email is taken
      console.log("[UpdateEmail] Email is taken by another user");
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }

    // Find current user's profile
    let currentProfile = null;

    // Try to find by current auth email
    if (currentAuthEmail) {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, line_user_id")
        .eq("email", currentAuthEmail)
        .single();
      currentProfile = data;
    }

    // Try to find by LINE user ID
    if (!currentProfile && lineUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, line_user_id")
        .eq("line_user_id", lineUserId)
        .single();
      currentProfile = data;
    }

    if (currentProfile) {
      // Update existing profile's email
      console.log("[UpdateEmail] Updating profile email from", currentProfile.email, "to", email);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          email: email,
          line_user_id: lineUserId || currentProfile.line_user_id
        })
        .eq("id", currentProfile.id);

      if (updateError) {
        console.error("[UpdateEmail] Update error:", JSON.stringify(updateError));
        if (updateError.code === "23505") {
          return NextResponse.json({ error: "email_exists" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: true });
    }

    // No existing profile - create new one
    console.log("[UpdateEmail] Creating new profile for:", email);
    const newId = randomUUID();

    const { error: insertError } = await supabase.from("profiles").insert({
      id: newId,
      email: email,
      display_name: authName,
      line_user_id: lineUserId,
    });

    if (insertError) {
      console.error("[UpdateEmail] Insert error:", JSON.stringify(insertError));
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
    console.error("[UpdateEmail] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
