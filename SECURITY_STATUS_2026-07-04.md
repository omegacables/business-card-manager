# セキュリティ再監査 結果と対応状況（2026-07-04）

前回: [SECURITY_CRITICAL.md](./SECURITY_CRITICAL.md)（2026-04-21）

## 本日修正済み（コミット前・要レビュー）

| # | 内容 | ファイル |
|---|------|---------|
| 1 | 【重大】メール本人確認なしのアカウント連携（乗っ取り）を遮断。既存プロフィールへのLINE連携は「セッションで所有が証明されたメール」の場合のみ許可 | `src/app/api/onboarding/route.ts`, `src/app/api/profile/update-email/route.ts` |
| 2 | 【重大】任意のLINE IDを所有証明なしで連携できる問題を遮断。連携はOAuthフロー（`/api/auth/line/link`）のみ、本APIは「解除」と「セッション由来ID」のみ受付 | `src/app/api/profile/update/route.ts` |
| 3 | 【重大】ダッシュボードに残っていた「他ユーザーの名刺5件を取得しログ出力する」デバッグコードを削除（旧 /api/debug の残骸） | `src/app/(dashboard)/dashboard/page.tsx` |
| 4 | PIIの生ログを全廃。認証・プロフィール系の console.log を logger（本番抑止）+ maskEmail/maskId に置換 | profile/update, update-email, onboarding, auth/line/* |
| 5 | Web検索のPostgRESTインジェクション対策（LINE検索は対策済みだったがWeb側が未適用） | `src/app/(dashboard)/cards/page.tsx` |
| 6 | sanitizeSearchQuery に `*`（PostgRESTワイルドカード）を追加 | `src/lib/validation.ts` |
| 7 | エラーレスポンスから内部情報（error.message / String(error)）を除去 | profile系ルート |
| 8 | 設定画面のLINE ID手入力欄を廃止し、OAuth連携ボタン＋連携解除ボタンに変更 | `src/app/(dashboard)/settings/page.tsx` |

※ UI変更の副作用: 「LINEで id と送信→手入力で連携」の旧フローは使用不可。正規の「LINEと連携する」ボタン（OAuth）を使用。

## 監査で確認済み・問題なし

- LINE Webhook署名検証（validateSignature、生body検証）✅
- Stripe Webhook署名検証（constructEvent）✅
- Storage private化＋署名付きURL（migration 003適用前提）✅
- 全テーブルRLS有効・service_roleキーのクライアント漏洩なし ✅
- .env系のgit除外・ハードコード鍵なし ✅
- CRUD系APIの認証＋user_id絞り込み ✅
- OCRファイル検証（Web経路: 10MB・MIME allowlist）✅

## 残課題（優先度順）

1. **本番Supabaseで migration 003 適用済みか実機確認**（storage.buckets.public=false）— コードからは検証不能
2. **LINE Webhook経路のusage更新が非atomic**（`webhook/line/route.ts` 136-155, 205-215）— RPC `increment_card_usage` への置換要。並行送信で月次上限超過の可能性
3. **CSVエクスポートの数式インジェクション**（`src/lib/export.ts` escapeCSV）— 先頭 `= + - @` の無害化（`'` 前置）追加要。OCR由来データのため細工名刺で攻撃可能
4. **レート制限なし** — 最低限 /api/ocr と認証系へ（Upstash等）
5. **署名URLのTTLが1年** — 表示毎再署名API（`refreshCardImageSignedUrl` は実装済みだが未使用）への切替
6. **middlewareが実質素通し** — 一括セッションチェックの追加を推奨（現状は各ルート個別チェック頼み）
7. LINE Webhookエラー返信に error.message を含めない（固定文言化）
8. LINE経路の画像サイズ検証追加
9. Stripe webhookの `metadata.user_email` フォールバックが機能していない（user_id列と型不一致）— 取りこぼしバグ
10. `.gitignore` 先頭にシェルコマンド混入（`cat > .gitignore << 'EOF'`）— 動作はするが整形推奨
11. `eslint.config.js` 不在で `npm run lint` が起動不可（ESLint 9移行未対応）
12. プライバシーポリシーに外部送信の明記が必要: 名刺画像→Google Cloud Vision、OCRテキスト→Gemini（失敗時OpenAI）

## 将来（正式対応）

- メール確認リンクによる本人確認フロー（現在は「連携拒否」で暫定対応。LINE先行ユーザーが既存Googleアカウントと統合したい場合は、Googleでログイン→「LINEと連携する」ボタンの経路を案内）
- Auth0→Supabase JWT連携によるRLS実効化（現状はadmin client頼みで、絞り込み漏れ1つで漏洩する構造）
