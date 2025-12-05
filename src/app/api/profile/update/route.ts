import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createClient } from "@supabase/supabase-js";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.sub;
    const body = await request.json();
    const { line_user_id } = body;

    console.log("[Profile Update] User ID:", userId);
    console.log("[Profile Update] LINE User ID:", line_user_id);

    const supabase = createAdminClient();

    // First check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from("profiles")
        .update({ line_user_id: line_user_id || null })
        .eq("id", userId);

      if (error) {
        console.error("[Profile Update] Update failed:", error);
        return NextResponse.json({ error: "Update failed", details: error.message }, { status: 500 });
      }
    } else {
      // Insert new profile (this might fail due to FK constraint)
      const { error } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          line_user_id: line_user_id || null,
          email: session.user.email,
          display_name: session.user.name,
        });

      if (error) {
        console.error("[Profile Update] Insert failed:", error);
        return NextResponse.json({
          error: "Insert failed",
          details: error.message,
          hint: "The profiles table may have a foreign key constraint on auth.users"
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile Update] Error:", error);
    return NextResponse.json({ error: "Internal error", details: String(error) }, { status: 500 });
  }
}
