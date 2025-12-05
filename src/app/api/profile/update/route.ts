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

    const userEmail = session.user.email;
    const authSub = session.user.sub;

    // Get LINE user ID from auth sub if available
    const authLineUserId = authSub?.startsWith("line|") ? authSub.replace("line|", "") : null;

    const body = await request.json();
    const { line_user_id } = body;

    // Use the LINE ID from the request, or from auth sub
    const targetLineUserId = line_user_id || authLineUserId;

    console.log("[Profile Update] User Email:", userEmail);
    console.log("[Profile Update] LINE User ID:", targetLineUserId);

    const supabase = createAdminClient();

    // If trying to set a LINE user ID, check if it's already used
    if (targetLineUserId) {
      const { data: existingLineProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("line_user_id", targetLineUserId)
        .single();

      if (existingLineProfile) {
        // LINE ID already used
        if (userEmail && existingLineProfile.email === userEmail) {
          // It's the same user, already linked
          console.log("[Profile Update] LINE already linked to this user");
          return NextResponse.json({ success: true, already_linked: true });
        }

        // LINE ID is used by another profile
        console.log("[Profile Update] LINE ID already used by:", existingLineProfile.email);
        return NextResponse.json({
          error: "line_already_linked",
          details: "このLINE IDは既に別のアカウントに紐づいています"
        }, { status: 409 });
      }
    }

    // Find user's profile by email or LINE ID
    let profile = null;

    if (userEmail) {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, line_user_id")
        .eq("email", userEmail)
        .single();
      profile = data;
    }

    if (!profile && authLineUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, line_user_id")
        .eq("line_user_id", authLineUserId)
        .single();
      profile = data;
    }

    if (profile) {
      // Update existing profile
      console.log("[Profile Update] Updating profile:", profile.id);
      const { error } = await supabase
        .from("profiles")
        .update({ line_user_id: targetLineUserId || null })
        .eq("id", profile.id);

      if (error) {
        console.error("[Profile Update] Update failed:", error);
        return NextResponse.json({ error: "Update failed", details: error.message }, { status: 500 });
      }
    } else if (userEmail) {
      // Insert new profile
      console.log("[Profile Update] Creating new profile for:", userEmail);
      const newId = randomUUID();
      const { error } = await supabase
        .from("profiles")
        .insert({
          id: newId,
          line_user_id: targetLineUserId || null,
          email: userEmail,
          display_name: session.user.name,
        });

      if (error) {
        console.error("[Profile Update] Insert failed:", error);
        return NextResponse.json({
          error: "Insert failed",
          details: error.message,
        }, { status: 500 });
      }

      // Create subscription
      await supabase.from("subscriptions").insert({
        user_id: newId,
        plan: "free",
        status: "active",
      });
    } else {
      return NextResponse.json({ error: "No email to create profile" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return NextResponse.json({ error: "Internal error", details: String(error) }, { status: 500 });
  }
}
