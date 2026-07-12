import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { randomUUID } from "crypto";

interface ResolveInput {
  email?: string | null;
  sub?: string | null;
  name?: string | null;
  picture?: string | null;
}

// Cookie セッション（Web）でも Bearer トークン（iOS）でも、
// 同じユーザー情報から profile を引く／作る共通処理。
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

// Bearer トークン（iOSアプリが渡す Auth0 access_token）を userinfo で検証
async function getUserFromBearer(token: string): Promise<ResolveInput | null> {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL!;
  const res = await fetch(`${issuer}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return { email: u.email, sub: u.sub, name: u.name, picture: u.picture };
}

export async function GET(request: NextRequest) {
  try {
    // 1) iOSアプリ: Authorization: Bearer <access_token>
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      const userInfo = await getUserFromBearer(token);
      if (!userInfo) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      return resolveUser(userInfo);
    }

    // 2) Web: Auth0 Cookie セッション
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
