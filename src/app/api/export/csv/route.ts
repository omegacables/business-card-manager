import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { generateCSV } from "@/lib/export";
import type { BusinessCard } from "@/types/database";

// Helper to get user's profile ID
async function getUserProfileId(session: { user: { email?: string; sub?: string } } | null): Promise<string | null> {
  if (!session) return null;

  const supabase = createAdminClient();
  const userEmail = session.user.email;
  const lineUserId = session.user.sub?.startsWith("line|")
    ? session.user.sub.replace("line|", "")
    : null;

  let profile = null;
  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", userEmail)
      .single();
    profile = data;
  }
  if (!profile && lineUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();
    profile = data;
  }
  return profile?.id || null;
}

export async function GET() {
  const session = await auth0.getSession();
  const userId = await getUserProfileId(session);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
  }

  const cards = (data || []) as BusinessCard[];
  const csv = generateCSV(cards);
  const now = new Date();
  const fileName = "business_cards_" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + ".csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"" + fileName + "\"",
    },
  });
}
