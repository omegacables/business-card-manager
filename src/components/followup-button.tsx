"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, Copy, RefreshCw } from "lucide-react";

export function FollowUpButton({ cardId, cardEmail }: { cardId: string; cardEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState<"formal" | "casual">("formal");
  const [draft, setDraft] = useState<string | null>(null);

  const generate = async (selectedTone: "formal" | "casual") => {
    setLoading(true);
    setTone(selectedTone);
    try {
      const res = await fetch(`/api/cards/${cardId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "生成に失敗しました");
      }
      setDraft(data.draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("下書きをコピーしました");
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  const openMailer = () => {
    if (!draft || !cardEmail) return;
    const subjectMatch = draft.match(/^件名[:：]\s*(.+)$/m);
    const bodyMatch = draft.split(/^本文[:：]\s*$/m)[1];
    const subject = encodeURIComponent(subjectMatch?.[1]?.trim() ?? "");
    const bodyText = encodeURIComponent((bodyMatch ?? draft).trim());
    window.location.href = `mailto:${cardEmail}?subject=${subject}&body=${bodyText}`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !draft && !loading) {
          generate("formal");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" strokeWidth={1.8} />
          AI追いメール
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI追いメール下書き</DialogTitle>
          <DialogDescription>
            この方とのやり取りの記録をもとに、フォローアップメールの下書きを作成します。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tone === "formal" ? "default" : "outline"}
            disabled={loading}
            onClick={() => generate("formal")}
          >
            ビジネス（丁寧）
          </Button>
          <Button
            size="sm"
            variant={tone === "casual" ? "default" : "outline"}
            disabled={loading}
            onClick={() => generate("casual")}
          >
            カジュアル
          </Button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
            AIが下書きを作成しています...
          </div>
        ) : draft ? (
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-72 overflow-y-auto font-sans">
              {draft}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copyDraft} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
                コピー
              </Button>
              {cardEmail && (
                <Button size="sm" variant="outline" onClick={openMailer}>
                  メールアプリで開く
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={() => generate(tone)}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                作り直す
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
