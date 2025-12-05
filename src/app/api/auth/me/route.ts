import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createClient } from "@supabase/supabase-js";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.sub;
    const supabase = createAdminClient();

    // Get or create profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: session.user.email,
          display_name: session.user.name,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create profile:", createError);
        return NextResponse.json(
          { user: { id: userId, email: session.user.email }, profile: null },
          { status: 200 }
        );
      }

      return NextResponse.json({
        user: {
          id: userId,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture,
        },
        profile: newProfile,
      });
    }

    return NextResponse.json({
      user: {
        id: userId,
        email: session.user.email,
        name: session.user.name,
        picture: session.user.picture,
      },
      profile,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
