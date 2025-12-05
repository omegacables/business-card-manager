"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authSub, setAuthSub] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      try {
        // Fetch user info from Auth0 session
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        const user = data.user;

        if (!user) {
          router.push("/login");
          return;
        }

        // Store Auth0 sub for later
        setAuthSub(user.sub || null);

        // If user already has email, redirect to dashboard
        if (user.email) {
          router.push("/dashboard");
          return;
        }

        // Pre-fill display name from provider
        if (user.name) {
          setDisplayName(user.name);
        }

        setInitialLoading(false);
      } catch (err) {
        console.error("Error checking user:", err);
        router.push("/login");
      }
    }

    checkUser();
  }, [router]);

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
      // Create/update profile with the provided email
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          display_name: displayName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "email_exists") {
          setError("このメールアドレスは既に使用されています。別のメールアドレスを入力するか、そのメールアドレスでログインしてください。");
        } else {
          setError(data.error || "プロフィールの設定に失敗しました");
        }
        setLoading(false);
        return;
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
            LINEログインにはメールアドレスが含まれていないため、メールアドレスを入力してください
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
                Googleアカウントと同じメールアドレスを入力すると、どちらでログインしても同じアカウントとして認識されます
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
