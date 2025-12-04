"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPage() {
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [currentLineUserId, setCurrentLineUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // LINE公式アカウントのURL（環境変数から取得、またはデフォルト）
  const lineOfficialUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || "";

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">設定</h1>

      {/* LINE連携カード */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#06C755]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            LINE連携
          </CardTitle>
          <CardDescription>
            LINE Botから名刺を登録するには、LINEユーザーIDを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 友だち追加ボタン */}
          {lineOfficialUrl && (
            <div className="p-4 bg-[#06C755]/10 dark:bg-[#06C755]/20 rounded-lg">
              <h3 className="font-medium text-foreground mb-3">Step 1: 公式アカウントを友だち追加</h3>
              <a
                href={lineOfficialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b34c] text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                友だち追加
              </a>
            </div>
          )}

          {/* LINE ID設定 */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-3">
              {lineOfficialUrl ? "Step 2: " : ""}LINE ユーザーIDを設定
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="lineUserId">LINE ユーザーID</Label>
                <Input
                  id="lineUserId"
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  LINEで「id」と送信するとユーザーIDを確認できます。
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "保存中..." : "保存"}
                </Button>
                {currentLineUserId && (
                  <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    連携済み
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 使い方 */}
          <div className="p-4 border border-border rounded-lg">
            <h3 className="font-medium text-foreground mb-3">使い方</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>上の「友だち追加」ボタンからLINE公式アカウントを追加</li>
              <li>LINEで「id」と送信してユーザーIDを取得</li>
              <li>取得したIDを上の入力欄に貼り付けて保存</li>
              <li>LINEで名刺の写真を送信すると自動で登録されます</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* 外観設定カード */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            外観
          </CardTitle>
          <CardDescription>
            アプリの表示テーマを変更できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                ライト
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                ダーク
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                システム
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
