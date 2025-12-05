"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Pre-fill with data from OAuth provider if available
      const providerEmail = user.email;
      const providerName = user.user_metadata?.full_name ||
                          user.user_metadata?.name ||
                          user.user_metadata?.display_name || "";

      // Check if profile is already complete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("email, display_name")
        .eq("id", user.id)
        .single();

      const profileData = profile as { email: string | null; display_name: string | null } | null;

      if (profileData?.email && profileData?.display_name &&
          !profileData.email.endsWith("@line.local")) {
        // Profile already complete, redirect to dashboard
        router.push("/dashboard");
        return;
      }

      // Pre-fill the form
      if (providerEmail && !providerEmail.endsWith("@line.local")) {
        setEmail(providerEmail);
      }
      setDisplayName(providerName);
      setInitialLoading(false);
    }

    checkUser();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !displayName) {
      setError("すべての項目を入力してください");
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("有効なメールアドレスを入力してください");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          email: email,
          display_name: displayName,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        setError("プロフィールの更新に失敗しました");
        setLoading(false);
        return;
      }

      // Also update auth user email if different
      if (user.email !== email) {
        await supabase.auth.updateUser({ email: email });
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("エラーが発生しました");
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">プロフィール設定</CardTitle>
          <CardDescription className="text-center">
            サービスを利用するために必要な情報を入力してください
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="displayName">お名前 <span className="text-destructive">*</span></Label>
              <Input
                id="displayName"
                type="text"
                placeholder="山田 太郎"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="example@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                通知やアカウント情報の送信に使用します
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "保存中..." : "設定を完了する"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
