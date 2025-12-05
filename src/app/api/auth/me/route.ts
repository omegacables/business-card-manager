import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: "No email in session" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get or create profile using email as ID
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userEmail)
      .single();

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userEmail,
          email: userEmail,
          display_name: session.user.name,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create profile:", createError);
        return NextResponse.json(
          { user: { id: userEmail, email: userEmail }, profile: null },
          { status: 200 }
        );
      }

      return NextResponse.json({
        user: {
          id: userEmail,
          email: userEmail,
          name: session.user.name,
          picture: session.user.picture,
        },
        profile: newProfile,
      });
    }

    return NextResponse.json({
      user: {
        id: userEmail,
        email: userEmail,
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
