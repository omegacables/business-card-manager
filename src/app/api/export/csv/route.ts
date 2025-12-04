import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCSV } from "@/lib/export";
import type { BusinessCard } from "@/types/database";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("user_id", user.id)
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
