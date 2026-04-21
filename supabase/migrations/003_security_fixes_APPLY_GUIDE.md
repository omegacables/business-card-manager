# Migration 003 適用手順（社長作業）

**重要**: コード側の変更はデプロイ済みだが、Supabase DB 側のマイグレーション適用は**手動**で必要です。

このマイグレーションを適用しないと:
- 名刺画像アップロードが失敗する（`card-images` バケットが public のまま）
- 月次使用回数カウントが `RPC 関数なし` でエラーになる

---

## 適用方法（どちらか1つ）

### 方法A: Supabase CLI で適用（推奨）

```bash
cd C:/Users/Lotus/BusinessCard
supabase db push
```

※ `supabase login` 済み・プロジェクトリンク済みが前提。

### 方法B: Supabase Dashboard の SQL Editor で手動適用

1. https://supabase.com/dashboard にログイン
2. 対象プロジェクトを開く
3. 左メニュー **「SQL Editor」** をクリック
4. **New query** で以下のファイル内容を貼り付け:
   `supabase/migrations/003_security_fixes.sql`
5. **Run** ボタンで実行
6. エラーなく完了するのを確認

---

## 適用後の確認

### 1. バケットが private になったか
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'card-images';
-- public が false になっているべき
```

### 2. RPC 関数が作成されたか
```sql
SELECT proname FROM pg_proc WHERE proname = 'increment_card_usage';
-- 1 行返ってくるべき
```

### 3. 動作テスト
1. ログイン → 名刺を新規OCR登録 → エラーなく保存される
2. 登録した名刺の画像が表示される（signed URL 経由）
3. Free プランで 10 枚登録 → 11 枚目は「上限」エラーが出る

---

## ロールバック（万が一問題が出た場合）

```sql
-- バケットを public に戻す
UPDATE storage.buckets SET public = true WHERE id = 'card-images';

-- 元の閲覧ポリシーを復活
DROP POLICY IF EXISTS "Users can view own card images" ON storage.objects;
CREATE POLICY "Users can view card images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-images');

-- RPC 関数を削除（アプリ側も戻す必要あり）
DROP FUNCTION IF EXISTS increment_card_usage(UUID, TEXT, INTEGER);
```

ただし、ロールバックするとセキュリティ問題が戻るので、**可能な限り修正で前進**することを推奨します。
