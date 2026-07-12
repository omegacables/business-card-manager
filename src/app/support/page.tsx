import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "サポート | 名刺管理アプリ",
  description:
    "名刺管理アプリ（株式会社Renaxis）のサポートページ。使い方、よくある質問、お問い合わせ先を掲載しています。",
};

const CONTACT = "info@renaxis.jp";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "ログインできません／どのログイン方法がありますか？",
    a: "Google、LINE、Apple（Sign in with Apple）のいずれかでログインできます。うまくいかない場合は、通信環境をご確認のうえアプリを再起動してお試しください。それでも解決しない場合は下記までご連絡ください。",
  },
  {
    q: "名刺はどうやって登録しますか？",
    a: "ホーム画面から名刺を撮影すると、文字認識（OCR）とAIが会社名・氏名・連絡先などを自動で読み取り、入力欄に反映します。内容を確認・修正して保存してください。手入力での登録も可能です。",
  },
  {
    q: "文字がうまく読み取れません。",
    a: "明るい場所で、名刺全体がはっきり写るように撮影すると精度が上がります。読み取り結果は保存前に手動で修正できます。",
  },
  {
    q: "料金プランについて教えてください。",
    a: "無料でご利用いただけます。名刺画像の保存など一部の機能は有料プランでご利用いただけます。お支払いはアプリ内の案内に従って行えます。",
  },
  {
    q: "登録した名刺データを削除したい。",
    a: "各名刺の詳細画面から個別に削除できます。データの取り扱いについてはプライバシーポリシーをご覧ください。",
  },
  {
    q: "アカウントを削除（退会）したい。",
    a: (
      <>
        アプリ内の設定画面にある「アカウント削除」からいつでも削除できます。削除すると、アカウント情報に加え、登録したすべての名刺データ・名刺画像・活動履歴・購読情報など、サーバー上のデータがすべて削除され、復元はできません。アプリからの操作が難しい場合は下記メールへご連絡ください。
      </>
    ),
  },
  {
    q: "パスワードを忘れました。",
    a: "本サービスはGoogle・LINE・Appleによるログインのみを使用しており、当社が独自のパスワードを保持することはありません。各サービスのアカウントでログインしてください。",
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <p className="text-xs font-medium text-muted-foreground">名刺管理アプリ</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
        サポート
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        名刺管理アプリのサポートページです。ご不明な点は、以下のよくある質問をご確認のうえ、解決しない場合はお問い合わせ窓口までご連絡ください。
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-foreground">お問い合わせ窓口</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          メール：
          <a className="text-primary underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          <br />
          受付：随時（返信は通常、数営業日以内に行います）
          <br />
          運営：株式会社Renaxis
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-foreground">よくある質問</h2>
        <div className="mt-4 space-y-6">
          {FAQ.map((item, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold text-foreground">
                Q. {item.q}
              </h3>
              <p className="mt-1.5 text-sm leading-7 text-muted-foreground">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 border-t border-border pt-6 text-sm">
        <Link href="/policy" className="text-primary underline">
          プライバシーポリシー
        </Link>
      </div>
    </main>
  );
}
