import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardForm } from "@/components/card-form";
import type { BusinessCard } from "@/types/database";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">名刺の編集</h1>
      <CardForm initialData={card} mode="edit" />
    </div>
  );
}
