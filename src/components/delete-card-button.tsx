"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeleteCardButtonProps {
  cardId: string;
  cardName: string;
}

export function DeleteCardButton({ cardId, cardName }: DeleteCardButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("business_cards")
        .delete()
        .eq("id", cardId);

      if (error) throw error;

      toast.success("名刺を削除しました");
      router.push("/cards");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">削除</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>名刺の削除</DialogTitle>
          <DialogDescription>
            「{cardName}」の名刺を削除しますか？この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "削除中..." : "削除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
