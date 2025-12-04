import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <main className="text-center space-y-8 px-4">
        <h1 className="text-4xl font-bold text-gray-900">
          名刺管理Bot
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          名刺をスキャンして簡単管理。
          LINEから写真を送るだけで自動登録。
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">ログイン</Button>
          </Link>
          <Link href="/signup">
            <Button size="lg" variant="outline">
              新規登録
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-3xl mx-auto">
          <FeatureCard
            title="OCR読み取り"
            description="名刺の写真から自動で情報を抽出"
          />
          <FeatureCard
            title="LINE連携"
            description="LINEで写真を送るだけで登録"
          />
          <FeatureCard
            title="簡単エクスポート"
            description="vCardやCSVで連絡先を出力"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}
