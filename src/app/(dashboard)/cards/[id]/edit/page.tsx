import { notFound, redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { createClient } from "@supabase/supabase-js";
import { CardForm } from "@/components/card-form";
import type { BusinessCard } from "@/types/database";

// Admin client to bypass RLS
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/login");
  }

  const userId = session.user.sub;
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("business_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    notFound();
  }

  const card = data as BusinessCard;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">名刺の編集</h1>
      <CardForm initialData={card} mode="edit" />
    </div>
  );
}
