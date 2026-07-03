"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Contact, ScanText, MessageCircle, FileDown, ShieldCheck, type LucideIcon } from "lucide-react";

function HomeContent() {
  const [error, setError] = useState<string | null>(null);
  const [lineLoading, setLineLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            // User is logged in, redirect to dashboard
            router.push("/dashboard");
            return;
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      }
      setCheckingAuth(false);
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        auth_failed: "ログインに失敗しました",
        access_denied: "アクセスが拒否されました",
      };
      setError(errorMessages[errorParam] || "エラーが発生しました");
    }
  }, [searchParams]);

  const handleLineLogin = () => {
    setLineLoading(true);
    window.location.href = "/auth/login?connection=line&returnTo=/dashboard";
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    window.location.href = "/auth/login?connection=google-oauth2&returnTo=/dashboard";
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <main className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Contact className="w-7 h-7" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            名刺管理Bot
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            LINEで送るだけ。大切なご縁を、きちんと管理。
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-center">ログイン / 新規登録</CardTitle>
            <CardDescription className="text-center">
              アカウントでログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            {/* LINE Login */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#06C755] hover:bg-[#00B900] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              onClick={handleLineLogin}
              disabled={lineLoading || googleLoading}
            >
              {lineLoading ? (
                "接続中..."
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  LINEでログイン
                </>
              )}
            </button>

            {/* Google Login */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card hover:bg-accent text-foreground font-medium rounded-lg border border-border transition-colors disabled:opacity-50"
              onClick={handleGoogleLogin}
              disabled={lineLoading || googleLoading}
            >
              {googleLoading ? (
                "接続中..."
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Googleでログイン
                </>
              )}
            </button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid gap-3 sm:grid-cols-3">
          <FeatureCard
            icon={ScanText}
            title="OCR読み取り"
            description="名刺の写真から自動で情報を抽出"
          />
          <FeatureCard
            icon={MessageCircle}
            title="LINE連携"
            description="LINEで写真を送るだけで登録"
          />
          <FeatureCard
            icon={FileDown}
            title="エクスポート"
            description="vCardやCSVで連絡先を出力"
          />
        </div>

        {/* Trust note */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.8} />
          通信はすべて暗号化され、名刺データはご本人のみ閲覧できます
        </p>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 bg-card rounded-xl shadow-sm border border-border">
      <Icon className="w-5 h-5 text-primary mb-2" strokeWidth={1.8} />
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
