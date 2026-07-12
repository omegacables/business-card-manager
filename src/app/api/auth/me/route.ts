import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { getBearerUser, getProfileIdForBearerUser } from "@/lib/user";
import { randomUUID } from "crypto";

interface ResolveInput {
  email?: string | null;
  sub?: string | null;
  name?: string | null;
  picture?: string | null;
}

// Auth0 Cookie セッション（Web）のユーザー情報から profile を引く／作る共通処理。
async function resolveUser({ email: userEmail, sub: userSub, name: userName, picture: userPicture }: ResolveInput) {
  // Extract LINE user ID if this is a LINE login
  const lineUserId = userSub?.startsWith("line|") ? userSub.replace("line|", "") : null;

  const supabase = createAdminClient();

  // Try to find profile by email or LINE ID
  let profile = null;
  let profileError = null;

  if (userEmail) {
    // Look up by email first
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .single();
    profile = data;
    profileError = error;
  }

  // If no profile found by email, try by LINE ID
  if (!profile && lineUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
    profileError = error;
  }

  // If LINE user found a profile with email, return it
  if (profile) {
    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email || userEmail,
        sub: userSub,
        name: userName,
        picture: userPicture,
      },
      profile,
    });
  }

  // No profile found - if no email, can't create one
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

  const error = profileError;

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
}

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      // モバイルアプリはSupabaseのBearerトークンで認証する
      const bearer = await getBearerUser();
      if (!bearer) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const supabase = createAdminClient();
      const profileId = await getProfileIdForBearerUser(bearer);

      let profile = null;
      if (profileId) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profileId)
          .single();
        profile = data;
      }

      return NextResponse.json({
        user: {
          id: profileId ?? bearer.authUserId,
          email: profile?.email ?? bearer.email,
          sub: bearer.lineUserId ? `line|${bearer.lineUserId}` : bearer.authUserId,
          name: profile?.display_name ?? bearer.name,
          picture: bearer.picture,
        },
        profile,
      });
    }

    return resolveUser({
      email: session.user.email,
      sub: session.user.sub,
      name: session.user.name,
      picture: session.user.picture,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
