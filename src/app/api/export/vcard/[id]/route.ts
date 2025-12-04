import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVCard } from "@/lib/export";
import type { BusinessCard } from "@/types/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
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
