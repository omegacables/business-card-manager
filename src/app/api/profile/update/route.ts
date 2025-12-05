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

    const supabase = createAdminClient();

    // Upsert profile (create if not exists, update if exists)
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        line_user_id: line_user_id || null,
      }, {
        onConflict: "id",
      });

    if (error) {
      console.error("Profile update failed:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
