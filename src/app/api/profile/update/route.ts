import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "No email in session" }, { status: 400 });
    }

    const body = await request.json();
    const { line_user_id } = body;

    console.log("[Profile Update] User Email:", userEmail);
    console.log("[Profile Update] LINE User ID:", line_user_id);

    const supabase = createAdminClient();

    // First check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userEmail)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from("profiles")
        .update({ line_user_id: line_user_id || null })
        .eq("id", userEmail);

      if (error) {
        console.error("[Profile Update] Update failed:", error);
        return NextResponse.json({ error: "Update failed", details: error.message }, { status: 500 });
      }
    } else {
      // Insert new profile
      const { error } = await supabase
        .from("profiles")
        .insert({
          id: userEmail,
          line_user_id: line_user_id || null,
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return NextResponse.json({ error: "Internal error", details: String(error) }, { status: 500 });
  }
}
