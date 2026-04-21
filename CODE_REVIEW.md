# BusinessCard アプリ 包括コードレビュー

- 作成日: 2026-04-21
- 担当: Renaxis CEO（Claude Code）
- 対象: `C:/Users/Lotus/BusinessCard/`
- ステータス: **本番ローンチ前 / 5月末目標**

---

## 🎯 総評

アプリの**機能設計とUXは良好**です。OCR・LINE連携・Stripe決済・Auth0認証が統合された本格SaaS構成。しかし、**本番前に必ず対応すべき致命的なセキュリティ問題が複数**あります。

**現状の本番デプロイは推奨しません。** 下記 🔴 CRITICAL 項目を修正してからリリースしてください。

| 重要度 | 件数 |
|---|---|
| 🔴 **致命的（本番前必須）** | **6件** |
| 🟡 **高**（早期対応推奨） | 8件 |
| 🟢 **中**（次期対応可） | 10件 |
| ✅ **評価できる点** | 7件 |

---

# 🔴 CRITICAL - 本番前に必ず修正すべき問題

## 1. `/api/debug` ルートで他ユーザーのデータが漏洩

**問題箇所**: `src/app/api/debug/route.ts:48-51`

```typescript
// Get sample business cards
const { data: sampleCards } = await supabase
  .from("business_cards")
  .select("id, name, user_id")
  .limit(5);  // ❌ user_idフィルタなし = 他ユーザーの名刺が見える
```

認証されたユーザーは誰でも、**他のユーザーの名刺5件を取得可能**。

### 対処
- **本番前にこのルートを削除** または認証を厳格化
- 最低限 `.eq("user_id", profile.id)` を追加

---

## 2. 画像ストレージバケットが完全にパブリック

**問題箇所**: `supabase/migrations/001_initial_schema.sql:176-189`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true);  -- ❌ publicバケット

CREATE POLICY "Users can view card images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-images');  -- ❌ 誰でも閲覧可能
```

名刺画像は**個人情報の塊**（氏名・会社・住所・電話番号）。公開バケットは絶対NG。

### 対処
```sql
-- 1. バケットをプライベートに
UPDATE storage.buckets SET public = false WHERE id = 'card-images';

-- 2. 閲覧を所有者のみに制限
DROP POLICY "Users can view card images" ON storage.objects;
CREATE POLICY "Users can view own card images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'card-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

- コードも `getPublicUrl` → `createSignedUrl` (有効期限付き) に変更が必要

---

## 3. RLSが事実上無効化されている

**問題構造**:
- 認証はAuth0だが、RLSは Supabase Auth の `auth.uid()` に依存
- Auth0ユーザーは `auth.users` に存在しない → RLS常に失敗
- **全APIで `createAdminClient()` + service_role_key** を使用 = **RLS完全バイパス**

**影響**: DB側の最後の防衛線が機能していない。**アプリケーション層のバグ1つで全ユーザーの全データが漏れる**。

### 対処（優先度順）
1. **各API route で必ず `.eq("user_id", userId)` を徹底**（現状は基本できているが要全件確認）
2. **中期**: Supabase Auth への統一か、Custom JWT Claim でRLSを有効化
3. **最低限**: `createAdminClient` 使用箇所の監査リスト化

---

## 4. LINE検索でPostgREST Injection の可能性

**問題箇所**: `src/app/api/webhook/line/route.ts:377`

```typescript
.or(`name.ilike.%${query}%,company_name.ilike.%${query}%,...`)
```

`query` は LINE ユーザーの入力そのまま。`,` や `(` などの特殊文字で**フィルタロジックを破壊**し、他ユーザーのデータに到達する可能性。

### 対処
```typescript
// サニタイズ（カンマ・括弧を除去）
const sanitized = query.replace(/[,()%]/g, '');

// または、文字列エスケープして .filter() を使う
.filter('name', 'ilike', `%${sanitized}%`)
```

---

## 5. 月次利用回数カウントに競合状態（レースコンディション）

**問題箇所**: `src/lib/subscription.ts:97-133`

```typescript
// 1. Read
const usage = await getMonthlyUsage();
// 2. Check limit (ここで別リクエストが同じ数字を読む可能性)
if (!canRegisterCard(...)) { ... }
// 3. Increment (両方が+1してしまう)
await supabase.from("monthly_usage").upsert({ cards_registered: (old) + 1 });
```

連続リクエストで**月の上限を超過**できる。

### 対処
Postgresのatomic increment を使う:
```sql
CREATE OR REPLACE FUNCTION increment_card_usage(p_user_id UUID, p_year_month TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO monthly_usage (user_id, year_month, cards_registered)
  VALUES (p_user_id, p_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET cards_registered = monthly_usage.cards_registered + 1
  RETURNING cards_registered INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
```

それをRPCで呼び出す形に変更。

---

## 6. 機密情報をログに出力

**問題箇所**: `src/lib/auth0.ts:32-44`

```typescript
console.log("[Auth0 Callback] Session user:", session?.user?.email, session?.user?.sub);
console.log("[Auth0 Callback] Email:", email);
console.log("[Auth0 Callback] LINE user ID:", lineUserId);
```

Vercel Logs などに**メアド・LINE ID・sub** が生で残る。GDPR / 個情法リスク。

### 対処
- `console.log` を削除 or ハッシュ化
- 本番では構造化ロガー（Pino, Winston）+ PII マスキング
- **最低限、本番環境ではconsole.logを削除**

---

# 🟡 HIGH - 早期対応推奨

## 7. レート制限（Rate Limiting）が皆無

**影響**: OCR API を悪用されて **Google Vision + Gemini/OpenAI のコスト爆発**

### 対処
```typescript
// Upstash Rate Limit or Vercel Edge Config で
// IP / userId ごとに「分間N回」の制限
import { Ratelimit } from "@upstash/ratelimit";
```

月1000円〜の投資で**万円単位のコスト事故**を防げる。

---

## 8. 入力検証（Zod使用の徹底）不足

**問題**: `react-hook-form + zod` をインストール済みだがAPI側で未使用

```typescript
// 現状（例: cards/route.ts）
const body = await request.json();
const { name, email, ... } = body;  // ❌ 生信頼
```

### 対処
```typescript
import { z } from "zod";
const CardSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().nullable(),
  phone: z.string().regex(/^[\d\-+ ]+$/).nullable(),
  // ...
});
const body = CardSchema.parse(await request.json());
```

---

## 9. ファイルアップロード検証なし

**問題箇所**: `src/app/api/ocr/route.ts:29-37`

- **ファイルサイズ制限なし** → 100MBの画像でも受け付ける
- **MIMEタイプ検証なし** → 画像以外もVision APIに流す
- **署名付きURL・期限なし**

### 対処
```typescript
// サイズ制限（例: 10MB）
if (file.size > 10 * 1024 * 1024) {
  return NextResponse.json({ error: "File too large" }, { status: 413 });
}
// MIME検証
if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
  return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
}
```

---

## 10. プロフィールのemail依存性

**問題**: email を主キー的に使用。Auth0側でメアド変更された場合、データと切り離される。

### 対処
- `profiles.id` を Auth0 の `sub` と紐付ける設計にリファクタ
- または、Auth0のアカウントIDをセカンダリIDで保持

---

## 11. 重複コード（copy-paste）が多い

**問題**: `getUserProfileId` が 5〜6ファイルでコピペされている
- `src/app/api/cards/route.ts`
- `src/app/api/cards/[id]/route.ts`
- `src/app/api/export/csv/route.ts`
- `src/lib/subscription.ts`
- その他

### 対処
`src/lib/user.ts` を作り、一元化:
```typescript
// src/lib/user.ts
export async function getUserProfileId(): Promise<string | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  // ...
}
```

---

## 12. OCR の AIモデル呼び出し fallback が遅い

**問題**: Gemini → OpenAI → regex の順で**直列に呼び出す**（各数秒）
タイムアウト未設定。ユーザーが長時間待たされる。

### 対処
- タイムアウトを設ける（各10秒程度）
- 失敗時のログを明示化

---

## 13. エラーメッセージで内部情報が漏れる可能性

```typescript
return NextResponse.json({ error: String(error) }, { status: 500 });
```

本番環境では**内部エラーを抽象化**して返す:
```typescript
return NextResponse.json({ error: "Server error" }, { status: 500 });
```

---

## 14. CSRF対策が不明瞭

Next.js App Router + Auth0 の場合、基本は Cookie-only でプロテクトされるが、確認が必要:
- `SameSite=Lax` になっているか（Auth0 config で設定済みを確認済み）
- 重要操作には追加の**Origin検証**を検討

---

# 🟢 MEDIUM - 次期対応可

## 15. テストコード不在
- **Unitテスト**、**Integrationテスト**ともに皆無
- 最低限、`lib/subscription.ts` 等のロジックはテスト必須
- 推奨: Vitest + Testing Library

## 16. CI/CD未整備
- GitHub Actions設定なし
- PRでの**自動ビルド・テスト・lint** が欲しい
- 現状、手動デプロイに依存

## 17. エラー監視ツール未導入
- **Sentry** などのエラートラッキング導入推奨
- 本番の実エラーが把握できない

## 18. 画像の再エンコード・メタデータ削除なし
- 名刺画像のEXIF情報（GPS位置情報など）が残る可能性
- アップロード時にサーバー側で**再エンコード**推奨

## 19. Stripe webhook のイベント冪等性
- 同じイベントが2度来た場合、二重更新される可能性
- `event.id` を記録して既処理を検知する仕組みが欲しい

## 20. LINE署名検証のタイミング攻撃耐性
- `verifySignature` が timing-safe compare を使っているか要確認

## 21. Accessibility未対応
- ARIA属性・キーボードナビゲーションの検証が必要
- スクリーンリーダー対応

## 22. i18n 未対応（将来的に）
- 現状日本語固定
- 英語圏展開時にハードコードがボトルネックに

## 23. データ削除（退会機能）の挙動検証
- profile削除で cards も cascading delete される設計
- `auth.users` 削除時の挙動を本番前に確認

## 24. 画像OCRの重複登録チェックなし
- 同じ名刺を複数回撮影しても重複登録される

---

# ✅ 評価できる点

1. **Stripe Webhook Signature検証**が正しく実装されている
2. **LINE Signature検証**が実装されている
3. **Auth0**による認証実装（SDK v4の最新）
4. **RLS policy**が定義されている（実質効いてないが、意識はある）
5. **全APIで `.eq("user_id", userId)`** フィルタが貫徹されている
6. **PostgreSQLトリガー**で`updated_at`自動更新
7. **TypeScript strict mode**が有効

---

# 🎯 リリース前 必須対応チェックリスト

本番前に**絶対やること**（優先順）:

### Phase 1: 致命的なセキュリティ修正（1〜2日）
- [ ] **`/api/debug` ルート削除**（即座に）
- [ ] **Storageバケットをprivate化** + RLS設定 + `createSignedUrl`への切り替え
- [ ] **LINE検索のPostgREST injection対策**
- [ ] **console.logから機密情報削除**
- [ ] **月次usage増加をatomic処理に変更**

### Phase 2: 高優先度（2〜3日）
- [ ] **Rate Limiting導入**（Upstash推奨）
- [ ] **Zodスキーマ**で全APIの入力検証
- [ ] **ファイルサイズ/MIMEの検証**（OCR endpoint）
- [ ] **エラーメッセージの抽象化**
- [ ] **`getUserProfileId` の一元化**

### Phase 3: 運用準備（1〜2日）
- [ ] **Sentry導入**
- [ ] **基本E2Eテスト作成**（ログイン〜名刺登録〜削除）
- [ ] **本番環境変数の最終確認**（Auth0、Stripe、Supabase）
- [ ] **負荷試験**（同時アクセス 10-100）
- [ ] **バックアップ体制**（Supabaseの自動バックアップ確認）

---

# 📊 コード品質メトリクス（目測）

| 項目 | 評価 | 備考 |
|---|---|---|
| アーキテクチャ | 🟡 B | Auth0+Supabase混在で複雑 |
| コード可読性 | 🟢 A- | よく整理されている |
| セキュリティ | 🔴 D | 致命的な問題あり |
| パフォーマンス | 🟢 B | 現時点の規模なら問題なし |
| スケーラビリティ | 🟡 B | Rate Limit・Caching不足 |
| 保守性 | 🟡 B- | 重複コード多い |
| テストカバレッジ | 🔴 F | 0% |

**総合**: 🟡 **ローンチは延期推奨・Phase 1修正後にベータ可**

---

# 💡 補足: 全体アーキテクチャの提案

現状は Auth0（認証）× Supabase Auth（RLS）の混在で複雑化しています。

### 推奨アプローチ1: Auth0メインでRLS不使用
- **全API `createAdminClient` + app-level check**（現状の延長）
- アプリケーション層を**徹底的に固める**
- セキュリティの責任が**コード100%**

### 推奨アプローチ2: Supabase Authに統一
- Auth0 を外し、**Supabase Auth** に一本化
- RLSが効くので**DB層で最後の防衛線**
- LINE連携は Supabase Auth の `signInWithOAuth` で可

### 短期的には: **アプローチ1を強化**
大規模リファクタは後回しし、**現状をセキュアに固める**。
ただし、重要データを扱うため、**DB層の防衛線は常に意識**する。

---

# 🎁 優先対応を一気に修正するコミット案

以下の修正を**1つのPR**で一気に入れればPhase 1は完了:

1. `src/app/api/debug/route.ts` を削除
2. `supabase/migrations/003_security_fixes.sql` を作成（バケット privateize）
3. `src/lib/user.ts` に `getUserProfileId` を移行
4. `src/lib/rate-limit.ts` を作成（Upstash）
5. `src/lib/validation.ts` に Zod schema を定義
6. 各API routeで上記を使用
7. console.log から PII を削除
8. subscription.ts の usage increment を RPC化

**見積もり工数**: 社長対応で **2〜3日**

---

# 📋 次のステップ

1. **社長の承認**: 本レビュー内容のうち、どれを優先するか判断
2. **Phase 1 着手**: 致命的セキュリティの修正（私の支援可）
3. **QAチェックリスト作成**（別ドキュメントで提供可）
4. **リリース日の再調整**（5月末 → 修正次第で調整）
