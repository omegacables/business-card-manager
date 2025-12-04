"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPage() {
  const supabase = createClient();
  const [lineUserId, setLineUserId] = useState("");
  const [currentLineUserId, setCurrentLineUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("line_user_id")
          .eq("id", user.id)
          .single();
        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profile = data as any;
          setCurrentLineUserId(profile.line_user_id);
          setLineUserId(profile.line_user_id || "");
        }
      }
    }
    fetchProfile();
  }, [supabase]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("認証エラー");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ line_user_id: lineUserId || null })
        .eq("id", user.id);

      if (error) throw error;
      setCurrentLineUserId(lineUserId || null);
      toast.success("設定を保存しました");
    } catch (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>LINE連携</CardTitle>
          <CardDescription>
            LINE Botから名刺を登録するには、LINEユーザーIDを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lineUserId">LINE ユーザーID</Label>
            <Input
              id="lineUserId"
              value={lineUserId}
              onChange={(e) => setLineUserId(e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            <p className="text-sm text-gray-500">
              LINE Developersコンソールまたは公式アカウントから取得できます。
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
            {currentLineUserId && (
              <span className="text-sm text-green-600">連携済み</span>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">使い方</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>LINE公式アカウントを友だち追加</li>
              <li>上記のLINEユーザーIDを設定</li>
              <li>LINEで名刺の写真を送信</li>
              <li>自動で読み取り・登録されます</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
