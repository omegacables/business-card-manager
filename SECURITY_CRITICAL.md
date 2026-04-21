# 🚨 BusinessCard セキュリティ緊急対応書

- 作成日: 2026-04-21
- 優先度: **本番前 絶対対応**
- 所要時間: 2〜3日で完了可能

---

## ⚠️ 3行サマリー

1. **`/api/debug` ルートから他ユーザーの名刺データが漏れます**
2. **名刺画像のストレージが完全公開で、URLを知れば誰でも見えます**
3. **LINE検索にSQLインジェクション相当の脆弱性があります**

**現状の本番デプロイは個人情報保護法違反リスクが高いため、上記3点の修正後にリリースすることを強く推奨します。**

---

# 🔴 対応1: `/api/debug` ルートの削除

## 現状の問題
```typescript
// src/app/api/debug/route.ts:48-51
const { data: sampleCards } = await supabase
  .from("business_cards")
  .select("id, name, user_id")
  .limit(5);
```

**認証されたユーザーなら誰でも**、`https://[ドメイン]/api/debug` にアクセスするだけで**他のユーザーの名刺を5件見られます**。

## 修正方法（推奨）

```bash
# 最もシンプル: ファイル削除
rm src/app/api/debug/route.ts
```

## 代替案（デバッグ機能を残したい場合）
```typescript
// src/app/api/debug/route.ts を以下に置換
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const ALLOWED_EMAILS = ["info@renaxis.jp"]; // 管理者メアドのみ

export async function GET() {
  const session = await auth0.getSession();
  if (!session || !ALLOWED_EMAILS.includes(session.user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // 以下、管理者用のデバッグ情報のみ（他ユーザーのデータは出さない）
  return NextResponse.json({ user: session.user });
}
```

---

# 🔴 対応2: Storageバケットをprivate化

## 現状の問題
```sql
-- supabase/migrations/001_initial_schema.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true);  -- ❌ public
```

**Supabase Storageのpublic bucketは、URLを知ってれば誰でもアクセス可能**。名刺画像には氏名・住所・電話番号が写っており、個人情報の塊です。

## 修正方法

### Step 1: 新しいマイグレーション作成

```sql
-- supabase/migrations/003_security_fixes.sql

-- 1. バケットをprivateに変更
UPDATE storage.buckets
SET public = false
WHERE id = 'card-images';

-- 2. 既存の全許可ポリシーを削除
DROP POLICY IF EXISTS "Users can view card images" ON storage.objects;

-- 3. 所有者のみ閲覧可能なポリシーに差し替え
CREATE POLICY "Users can view own card images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'card-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

### Step 2: コード変更（`getPublicUrl` → `createSignedUrl`）

#### `src/app/api/ocr/route.ts` と `src/app/api/webhook/line/route.ts`

**Before**:
```typescript
const { data: urlData } = supabase.storage
  .from("card-images")
  .getPublicUrl(fileName);
imageUrl = urlData.publicUrl;
```

**After**:
```typescript
const { data: urlData, error: signedError } = await supabase.storage
  .from("card-images")
  .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1年有効

if (!signedError && urlData) {
  imageUrl = urlData.signedUrl;
}
```

### Step 3: 画像表示時の対応

名刺詳細ページで画像を表示する際、URLの有効期限切れに備えて**毎回署名付きURLを取得**する設計に変更。

#### 新規APIエンドポイント作成

```typescript
// src/app/api/cards/[id]/image-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/auth";
import { getUserProfileId } from "@/lib/user"; // ← 共通化後

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth0.getSession();
  const userId = await getUserProfileId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  // 1. 所有者確認 + image_url取得
  const { data: card } = await supabase
    .from("business_cards")
    .select("image_url")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!card?.image_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. URLからファイルパスを抽出
  const path = extractPathFromUrl(card.image_url);

  // 3. 新しい署名付きURLを発行
  const { data: signedData } = await supabase.storage
    .from("card-images")
    .createSignedUrl(path, 60 * 60); // 1時間

  return NextResponse.json({ url: signedData?.signedUrl });
}

function extractPathFromUrl(url: string): string {
  // publicURLやsignedURLからファイルパスを抜き出す
  const match = url.match(/card-images\/([^?]+)/);
  return match?.[1] ?? "";
}
```

---

# 🔴 対応3: LINE検索のPostgREST Injection対策

## 現状の問題
```typescript
// src/app/api/webhook/line/route.ts:377
.or(`name.ilike.%${query}%,company_name.ilike.%${query}%,...`)
```

LINEメッセージの `query` がそのままPostgRESTフィルタに埋め込まれます。

### 攻撃例
LINEで `検索 a%,name.ilike.%` を送ると、クエリ文字列が:
```
name.ilike.%a%,name.ilike.%%,company_name.ilike.%a%,name.ilike.%%,...
```
となり、**% だけで全件マッチ**するフィルタが生成されます。ただし現状のコードでは `.eq("user_id", profileData.id)` で絞られているため自分のデータの全件になりますが、将来的な仕様変更で漏洩リスクになります。

## 修正方法

```typescript
// src/app/api/webhook/line/route.ts の handleSearch内

// サニタイズ: 特殊文字を除去
const sanitizedQuery = query
  .replace(/[,()*%\\]/g, '')  // PostgRESTの特殊文字
  .trim()
  .slice(0, 100);  // 長さ制限

if (!sanitizedQuery) {
  await replyMessage(replyToken, [
    { type: "text", text: "検索キーワードが無効です。" }
  ]);
  return;
}

// より安全な複数カラム検索（JS側で組み立てず、textSearchを使う）
const { data: cards, error: searchError } = await supabase
  .from("business_cards")
  .select("id, name, company_name, department, position, email, phone, mobile")
  .eq("user_id", profileData.id)
  .or(`name.ilike.%${sanitizedQuery}%,company_name.ilike.%${sanitizedQuery}%`)
  .order("updated_at", { ascending: false })
  .limit(10);
```

### より堅牢な対応（推奨）
PostgRESTのfull-text search (tsvector) を使う:

```sql
-- マイグレーション追加
ALTER TABLE business_cards ADD COLUMN search_vector tsvector;
CREATE INDEX idx_cards_search ON business_cards USING gin(search_vector);

-- トリガーで自動更新
CREATE OR REPLACE FUNCTION update_card_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.company_name, '') || ' ' ||
    coalesce(NEW.department, '') || ' ' ||
    coalesce(NEW.position, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_card_search
  BEFORE INSERT OR UPDATE ON business_cards
  FOR EACH ROW EXECUTE FUNCTION update_card_search_vector();
```

```typescript
// アプリ側
.textSearch('search_vector', sanitizedQuery, { type: 'websearch' })
```

---

# 🟡 対応4: ログから個人情報削除（推奨）

## 現状の問題
```typescript
// src/lib/auth0.ts:32-44
console.log("[Auth0 Callback] Session user:", session?.user?.email, session?.user?.sub);
console.log("[Auth0 Callback] Email:", email);
console.log("[Auth0 Callback] LINE user ID:", lineUserId);
```

Vercel Logs などに**メアド・LINE ID**が生で残ります。GDPR/個情法的にNG。

## 修正方法

### 全console.log を環境変数で制御
```typescript
// src/lib/logger.ts を新規作成
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  error: (...args: unknown[]) => console.error(...args),  // エラーは常に出す
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
};

// PIIマスキング用ヘルパー
export function maskEmail(email?: string | null): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskId(id?: string | null): string {
  if (!id) return "";
  return id.slice(0, 8) + "***";
}
```

### 使用例
```typescript
// Before
console.log("[Auth0 Callback] Email:", email);

// After
import { logger, maskEmail } from "@/lib/logger";
logger.log("[Auth0 Callback] Email:", maskEmail(email));
```

---

# 🟡 対応5: 月次usage競合状態の修正

## 現状の問題
`src/lib/subscription.ts:97-133` の `incrementCardUsage()` は read-modify-write パターンで、並列リクエストで**上限を超過できます**。

## 修正方法

### Step 1: PostgreSQL関数作成

```sql
-- supabase/migrations/003_security_fixes.sql に追加

CREATE OR REPLACE FUNCTION increment_card_usage(
  p_user_id UUID,
  p_year_month TEXT,
  p_max_count INTEGER DEFAULT NULL  -- NULL = 無制限
) RETURNS TABLE(success BOOLEAN, current_count INTEGER, error TEXT) AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- UPSERT with atomic increment
  INSERT INTO monthly_usage (user_id, year_month, cards_registered)
  VALUES (p_user_id, p_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET
    cards_registered = monthly_usage.cards_registered + 1,
    updated_at = NOW()
  WHERE
    -- Proプラン等で無制限なら常にOK
    p_max_count IS NULL OR
    -- カウンタが上限未満ならインクリメント
    monthly_usage.cards_registered < p_max_count
  RETURNING cards_registered INTO v_new_count;

  IF v_new_count IS NULL THEN
    -- UPDATE のWHERE条件で弾かれた = 上限到達
    RETURN QUERY SELECT false, NULL::INTEGER, '月の登録上限に達しました'::TEXT;
  ELSE
    RETURN QUERY SELECT true, v_new_count, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: アプリ側で RPC 呼び出し

```typescript
// src/lib/subscription.ts
export async function incrementCardUsage(): Promise<{ success: boolean; error?: string }> {
  const userId = await getUserProfileId();
  if (!userId) return { success: false, error: "認証エラー" };

  const supabase = createAdminClient();
  const yearMonth = getCurrentYearMonth();
  const plan = await getUserPlan();
  const limits = getPlanLimits(plan);

  const { data, error } = await supabase.rpc('increment_card_usage', {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_max_count: limits.monthlyCardLimit, // null for pro
  }).single();

  if (error) {
    console.error("Usage increment RPC error:", error);
    return { success: false, error: "使用量の更新に失敗しました" };
  }

  if (!data.success) {
    return {
      success: false,
      error: data.error || "今月の登録上限に達しました",
    };
  }

  return { success: true };
}
```

---

# 📝 推奨実装順序（2〜3日）

## Day 1: 緊急セキュリティ対応
- [ ] `/api/debug` 削除
- [ ] Storage bucket private化マイグレーション作成・実行
- [ ] コード側で `createSignedUrl` に切り替え
- [ ] 画像取得APIエンドポイント新設

## Day 2: 堅牢化
- [ ] LINE検索サニタイズ実装
- [ ] logger 導入・ PII マスキング
- [ ] monthly_usage の atomic 化

## Day 3: 検証
- [ ] 2ユーザーでデータ分離テスト
- [ ] 画像URLの有効期限テスト
- [ ] LINE検索の特殊文字テスト
- [ ] 月次上限の並列テスト
- [ ] ステージング環境で本番相当テスト

---

# 🎯 本修正完了後の状態

- ✅ 他ユーザーのデータ漏洩ルートを全て塞いだ
- ✅ 名刺画像のアクセス制御が機能
- ✅ 検索インジェクション耐性がついた
- ✅ ログから機密情報が消えた
- ✅ 月次上限を確実に担保

**この状態でリリース可能**になります。

---

# 💡 上記以外の"今すぐ必要でない"セキュリティ改善

（次期対応でOK）

- Rate Limiting（Upstash）
- Zodによる入力検証
- ファイル検証（サイズ・MIME）
- Sentry等のエラー監視
- E2Eテスト自動化
- Supabase Auth への統合検討

---

## 🙋 対応について社長にお願いしたいこと

### 選択肢A: **私が全て対応する**（社長の承認があれば）
- 所要: 2〜3日
- コード変更・マイグレーション・テストまで一気に
- 完了後、PRで社長にレビュー依頼

### 選択肢B: **社長が実装、私がレビュー**
- 社長ご自身で修正
- 私が修正内容をレビュー・追加アドバイス

### 選択肢C: **共同作業**
- 難所（RPC関数作成等）は私が
- アプリ側コードは社長

どれにしますか? 動画制作との兼ね合いがあれば、**選択肢A**で私が一気に進めるのが効率的です。
