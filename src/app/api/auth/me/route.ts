import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = session.user.email;
    const userSub = session.user.sub;
    const userName = session.user.name;
    const userPicture = session.user.picture;

    // If no email (e.g., LINE login), return user info without profile
    // This allows the onboarding page to work
    if (!userEmail) {
      return NextResponse.json({
        user: {
          id: null,
          email: null,
          sub: userSub,
          name: userName,
          picture: userPicture,
        },
        profile: null,
      });
    }

    const supabase = createAdminClient();

    // Get or create profile using email column
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it with generated UUID
      const newId = randomUUID();
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: newId,
          email: userEmail,
          display_name: userName,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create profile:", JSON.stringify(createError));
        return NextResponse.json(
          { user: { id: newId, email: userEmail, sub: userSub, name: userName, picture: userPicture }, profile: null },
          { status: 200 }
        );
      }

      // Also create subscription
      await supabase.from("subscriptions").insert({
        user_id: newId,
        plan: "free",
        status: "active",
      });

      return NextResponse.json({
        user: {
          id: newId,
          email: userEmail,
          sub: userSub,
          name: userName,
          picture: userPicture,
        },
        profile: newProfile,
      });
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        email: userEmail,
        sub: userSub,
        name: userName,
        picture: userPicture,
      },
      profile,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
