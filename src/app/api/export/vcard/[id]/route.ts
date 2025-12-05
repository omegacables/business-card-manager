import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { generateVCard } from "@/lib/export";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth0.getSession();
  const userId = await getUserProfileId(session);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = data as BusinessCard;
  const vcard = generateVCard(card);
  const fileName = card.name.replace(/\s+/g, "_") + ".vcf";

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"" + encodeURIComponent(fileName) + "\"",
    },
  });
}
