import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | 名刺管理アプリ",
  description:
    "名刺管理アプリ（株式会社Renaxis）のプライバシーポリシー。取得する情報、利用目的、外部サービスへの提供、データの削除方法について定めます。",
};

const UPDATED = "2026年7月13日";
const CONTACT = "info@renaxis.jp";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <p className="text-xs font-medium text-muted-foreground">名刺管理アプリ</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
        プライバシーポリシー
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">最終改定日：{UPDATED}</p>

      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        株式会社Renaxis（以下「当社」）は、当社が提供する名刺管理アプリおよび関連サービス（以下「本サービス」）における利用者の個人情報を含む情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
      </p>

      <Section title="1. 事業者情報">
        <ul className="space-y-1">
          <li>事業者名：株式会社Renaxis</li>
          <li>代表者：代表取締役 安藤 蓮</li>
          <li>所在地：〒160-0022 東京都新宿区新宿2丁目12-13 新宿アントレサロンビル 2F</li>
          <li>
            お問い合わせ：
            <a className="text-primary underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
          </li>
        </ul>
      </Section>

      <Section title="2. 取得する情報">
        <p>本サービスでは、以下の情報を取得します。</p>
        <p className="font-medium text-foreground">(1) アカウント情報</p>
        <p>
          ログイン（Google、LINE、Appleのいずれか）に伴い、メールアドレス、表示名、プロフィール画像、および各サービスが発行する利用者識別子（ユーザーID等）を取得します。Apple「Sign in with
          Apple」でメールアドレスの非公開を選択された場合は、Appleが発行する非公開転送用メールアドレスを取得します。
        </p>
        <p className="font-medium text-foreground">(2) 名刺データ</p>
        <p>
          利用者が撮影・アップロード・入力した名刺に含まれる情報（氏名、フリガナ、会社名、部署、役職、メールアドレス、電話番号、住所、ウェブサイト、メモ等）および名刺画像（画像の保存は有料プランの機能です）。これらには利用者以外の第三者の個人情報が含まれます（第9条を参照）。
        </p>
        <p className="font-medium text-foreground">(3) 利用状況・技術情報</p>
        <p>
          本サービスの利用履歴、操作ログ、アクセス日時、端末・ブラウザに関する技術情報、エラー情報等。
        </p>
        <p className="font-medium text-foreground">(4) 決済情報</p>
        <p>
          有料プランをご利用の場合、iOSアプリではApple社のApp内課金（In-App
          Purchase）を通じて決済が行われ、購読状態の管理にRevenueCatを利用します。Web版では決済代行事業者（Stripe）を利用します。いずれの場合も、クレジットカード番号等の決済情報はApple社またはStripeが取得・管理し、当社はカード番号そのものを保持しません。当社は契約プランや購入・課金状況等を取得します。
        </p>
      </Section>

      <Section title="3. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供、本人認証、アカウント管理のため</li>
          <li>名刺画像の文字認識（OCR）およびAIによる項目解析・整理のため</li>
          <li>フォローアップ文面の生成等、本サービスの各機能を提供するため</li>
          <li>有料プランの提供および決済・課金管理のため</li>
          <li>お問い合わせ対応、重要なお知らせの連絡のため</li>
          <li>不正利用の防止、品質改善、障害対応のため</li>
        </ul>
      </Section>

      <Section title="4. 外部サービスへの提供・処理の委託">
        <p>
          本サービスの提供にあたり、以下の外部サービスに情報の処理を委託し、または情報を送信します。これらの一部は日本国外に所在するため、個人情報が国外に移転される場合があります。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase（データベース、認証、画像の保管）</li>
          <li>Auth0（Okta 社／ログイン認証）</li>
          <li>Google Cloud Vision API（名刺画像の文字認識・OCR）</li>
          <li>Google（Gemini）／OpenAI（名刺項目のAI解析、文面生成）</li>
          <li>Apple（iOSアプリのApp内課金）／RevenueCat（購読状態の管理）</li>
          <li>Stripe（Web版の決済処理）</li>
          <li>LINE（LINEログイン、LINE経由での画像の受け取り）</li>
          <li>Vercel（アプリケーションのホスティング）</li>
        </ul>
        <p>
          名刺画像・テキストは、上記の文字認識およびAI解析の目的でのみ各事業者に送信され、当社は当該データを外部の生成AIモデルの学習に利用しません。
        </p>
      </Section>

      <Section title="5. 第三者提供">
        <p>
          当社は、次のいずれかに該当する場合を除き、あらかじめ利用者の同意を得ることなく個人情報を第三者に提供しません。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令に基づく場合</li>
          <li>人の生命・身体・財産の保護に必要で、本人の同意取得が困難な場合</li>
          <li>本サービス提供に必要な範囲で前条の委託先に取り扱わせる場合</li>
        </ul>
        <p>本サービスでは、利用者情報を広告目的の第三者トラッキングには利用しません。</p>
      </Section>

      <Section title="6. データの安全管理">
        <p>
          当社は、取得した情報の漏えい、滅失またはき損の防止その他の安全管理のために、通信の暗号化、アクセス制御等の必要かつ適切な措置を講じます。
        </p>
      </Section>

      <Section title="7. 保有期間・データおよびアカウントの削除">
        <p>
          利用者は、本サービス内でいつでも登録した名刺データを削除できます。また、アプリ内の設定画面の「アカウント削除」機能から、いつでもアカウントを削除できます。
        </p>
        <p>
          アカウントを削除すると、アカウント情報に加え、<span className="font-medium text-foreground">登録したすべての名刺データ、名刺画像、活動履歴（タイムライン）、契約・購読情報など、当社サーバー上に保存された当該利用者のデータがすべて削除されます</span>。削除されたデータは復元できません（法令で一定期間の保存が義務付けられている情報を除きます）。
        </p>
        <p>
          アプリからの操作が難しい場合は、
          <a className="text-primary underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          までご連絡いただければ、ご本人確認のうえ削除します。
        </p>
      </Section>

      <Section title="8. 利用者の権利">
        <p>
          利用者は、当社が保有する自己の個人情報について、開示、訂正、追加、削除、利用停止等を請求できます。ご請求は上記のお問い合わせ先までご連絡ください。
        </p>
      </Section>

      <Section title="9. 名刺に含まれる第三者の個人情報の取り扱い">
        <p>
          名刺データには、利用者ご自身以外の第三者の個人情報が含まれます。利用者は、名刺情報を本サービスに登録・利用するにあたり、適用される法令を遵守し、当該第三者の個人情報を適法に取り扱う責任を負うものとします。当社は、利用者の指示に基づき、本サービスの提供に必要な範囲でこれらの情報を処理します。
        </p>
      </Section>

      <Section title="10. Cookie等">
        <p>
          本サービスは、ログイン状態の維持等のためにCookieおよび類似技術を使用します。これらは本サービスの提供に必要な範囲で利用します。
        </p>
      </Section>

      <Section title="11. お子さまの利用">
        <p>
          本サービスは事業者・社会人の利用を主に想定しており、未成年者が利用する場合は保護者の同意を得たうえでご利用ください。
        </p>
      </Section>

      <Section title="12. 本ポリシーの改定">
        <p>
          当社は、必要に応じて本ポリシーを改定することがあります。重要な変更を行う場合は、本サービス上でお知らせします。改定後のポリシーは、本ページに掲載した時点から効力を生じます。
        </p>
      </Section>

      <Section title="13. お問い合わせ窓口">
        <p>
          本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。
        </p>
        <p>
          株式会社Renaxis　個人情報お問い合わせ窓口
          <br />
          <a className="text-primary underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
      </Section>

      <div className="mt-12 border-t border-border pt-6 text-sm">
        <Link href="/support" className="text-primary underline">
          サポート・お問い合わせページ
        </Link>
      </div>
    </main>
  );
}
