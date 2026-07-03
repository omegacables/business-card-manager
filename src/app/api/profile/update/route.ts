import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { randomUUID } from "crypto";
import { logger, maskEmail, maskId } from "@/lib/logger";

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

    // Only two operations are allowed here:
    //  - unlink (line_user_id: null)
    //  - link the LINE ID proven by the current session (LINE login)
    // Linking an arbitrary LINE ID would let anyone hijack another user's
    // LINE-submitted cards; that flow must go through /api/auth/line/link (OAuth).
    if (line_user_id && line_user_id !== authLineUserId) {
      return NextResponse.json({
        error: "line_link_requires_oauth",
        details: "LINE連携は「LINEアカウントを連携」ボタンから行ってください",
      }, { status: 403 });
    }

    const targetLineUserId = line_user_id || authLineUserId;

    logger.log("[Profile Update] User Email:", maskEmail(userEmail));
    logger.log("[Profile Update] LINE User ID:", maskId(targetLineUserId));

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
          logger.log("[Profile Update] LINE already linked to this user");
          return NextResponse.json({ success: true, already_linked: true });
        }

        // LINE ID is used by another profile
        logger.log("[Profile Update] LINE ID already used by:", maskEmail(existingLineProfile.email));
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
      logger.log("[Profile Update] Updating profile:", maskId(profile.id));
      const { error } = await supabase
        .from("profiles")
        .update({ line_user_id: targetLineUserId || null })
        .eq("id", profile.id);

      if (error) {
        logger.error("[Profile Update] Update failed:", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }
    } else if (userEmail) {
      // Insert new profile
      logger.log("[Profile Update] Creating new profile for:", maskEmail(userEmail));
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
        logger.error("[Profile Update] Insert failed:", error);
        return NextResponse.json({ error: "Insert failed" }, { status: 500 });
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
    logger.error("[Profile Update] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
