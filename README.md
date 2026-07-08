# 名刺管理Bot（Business Card Manager）

LINEで名刺の写真を送るだけで登録できる、日本のビジネスユーザー向け名刺管理SaaS。
Webアプリ（このリポジトリ）と LINE Bot が同じバックエンドを共有する。

- 本番: https://business-card-manager-ruddy.vercel.app/
- iOSネイティブアプリ（Rork Max製・別リポジトリ予定）はこのバックエンドのAPIクライアントとなる

## アーキテクチャ

```
[Webブラウザ] ─┐
[iOSアプリ]   ─┼─→ Next.js 16 (Vercel) ─→ Supabase (PostgreSQL + Storage)
[LINEトーク]  ─┘        │
                        ├─→ Auth0（ログイン: LINE / Google）
                        ├─→ Google Cloud Vision（名刺OCR）
                        ├─→ Gemini 2.0 Flash（情報抽出・会話要約・追いメール生成。失敗時 OpenAI gpt-4o-mini）
                        └─→ Stripe（Pro プラン課金）
```

- フレームワーク: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- フォント: Noto Sans JP / テーマ: 藍色（ジャパンブルー）基調、ライト/ダーク対応
- DBアクセスはすべてサーバー側（service role）で行い、各クエリで `user_id` による所有者絞り込みを必須とする

## データモデル（Supabase / PostgreSQL）

| テーブル | 用途 | 主なカラム |
|---|---|---|
| `profiles` | ユーザー | id, email, display_name, line_user_id |
| `business_cards` | 名刺（人） | id, user_id, name, name_kana, company_name, department, position, email, phone, mobile, fax, postal_code, address, website, notes, image_url |
| `activities` | やり取りの履歴（アポ・商談・会話） | id, user_id, card_id, type(meeting/call/email/line/note/task), title, content, occurred_at, source(manual/line/calendar/ai) |
| `line_inbox` | LINE転送メッセージの一時バッファ | id, user_id, content, created_at |
| `subscriptions` | プラン（free/pro）・Stripe連携 | user_id, plan, status, stripe_* |
| `monthly_usage` | 月あたり登録枚数（freeは10枚/月） | user_id, year_month, cards_registered |

- 名刺画像は Supabase Storage の **privateバケット** `card-images` に保存し、表示のたびに短命の署名付きURLを発行する
- スキーマは `supabase/migrations/` を参照

## 認証

- Web: Auth0 のセッションCookie（LINEログイン / Googleログイン）。`/auth/login?connection=line|google-oauth2` でログイン開始
- **モバイルアプリ向けのBearerトークン認証は未実装（今後追加予定）**。現状のAPIはすべてCookieセッション前提

## API エンドポイント（App Router / すべて認証必須・本人のデータのみ）

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/auth/me` | ログイン中ユーザーとプロフィール取得 |
| GET/POST | `/api/cards` | 名刺一覧取得 / 新規登録 |
| PUT/DELETE | `/api/cards/[id]` | 名刺更新 / 削除 |
| POST | `/api/cards/[id]/followup` | AI追いメール下書き生成。body: `{ tone: "formal" \| "casual" }` → `{ draft }` |
| POST | `/api/ocr` | 名刺画像のOCR＋AI解析（multipart、10MB以下、JPEG/PNG/WebP） |
| GET | `/api/export/csv` | 全名刺のCSVエクスポート |
| GET | `/api/export/vcard/[id]` | vCardエクスポート |
| POST | `/api/profile/update` | LINE連携の解除（連携はOAuthフローのみ） |
| POST | `/api/profile/update-email` | メールアドレス変更 |
| POST | `/api/stripe/checkout` / `/api/stripe/portal` | Pro プラン購入 / 管理 |
| POST | `/api/stripe/webhook` | Stripe Webhook（署名検証） |
| POST | `/api/webhook/line` | LINE Webhook（署名検証） |
| GET | `/api/auth/line/link` | LINEアカウント連携のOAuth開始 |

## LINE Bot コマンド

| 送信内容 | 動作 |
|---|---|
| 名刺の写真 | OCR＋AI解析して名刺登録（freeは10枚/月） |
| `検索 <名前>` / `@<名前>` | 名刺検索 |
| （任意のテキスト/転送） | 会話バッファに蓄積 |
| `記録 <名前>` | バッファをAIが要約し、その人の `activities` に保存（タイトル・分類・タスク抽出） |
| `クリア` | バッファ破棄 |
| `ヘルプ` / `id` | 使い方 / LINEユーザーID表示 |

## プラン

| | Free | Pro |
|---|---|---|
| 名刺登録 | 10枚/月 | 無制限 |
| 名刺画像の保存・表示 | ✕ | ○ |

## 環境変数（値はVercel/.env.localで管理。リポジトリには含めない）

`AUTH0_*` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` / `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` / `GOOGLE_CLOUD_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`(任意) / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_*` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_LINE_ADD_FRIEND_URL`

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

DBマイグレーションは `supabase/migrations/` のSQLを Supabase の SQL Editor で順に実行する。

## iOSアプリ（Rork Max）向けメモ

- 画面・データ構造はこのREADMEの「データモデル」「API」を正とする
- プロンプト例: [docs/RORK_MAX_PROMPTS.md](docs/RORK_MAX_PROMPTS.md)
- App Store 審査要件: サードパーティログイン（LINE/Google）を載せる場合は **Sign in with Apple の併設が必須**（ガイドライン4.8）
