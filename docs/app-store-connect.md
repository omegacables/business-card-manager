# App Store Connect 提出内容（名刺管理アプリ）

対象アプリ: 名刺管理アプリ（株式会社Renaxis）
ベースBundle ID: `app.rork.tyl7sdawrtvvc61p9zjd0`
最終更新: 2026-07-13

> このファイルは App Store Connect に入力する内容の下書きです。各項目をコピーして貼り付けてください。
> **審査に出す直前の「必須対応チェックリスト」を末尾に記載しています。特にアカウント削除機能は必読です。**

---

## 0. 公開URL（先に用意済み）

| 項目 | URL |
|---|---|
| プライバシーポリシー（Privacy Policy URL） | `https://business-card-manager-ruddy.vercel.app/policy` |
| サポート（Support URL） | `https://business-card-manager-ruddy.vercel.app/support` |
| マーケティング（Marketing URL・任意） | `https://business-card-manager-ruddy.vercel.app/` |

---

## 1. App 情報（App Information）

| 項目 | 内容 |
|---|---|
| 名前（App Name・最大30字） | **名刺管理 Renaxis**（※要検討。ストア内で一意である必要あり。候補下記） |
| サブタイトル（最大30字） | **撮るだけAI名刺管理・人脈整理** |
| プライマリ言語 | 日本語 |
| バンドルID | `app.rork.tyl7sdawrtvvc61p9zjd0` |
| SKU（任意の管理用ID） | `renaxis-meishi-001` |
| プライマリカテゴリ | ビジネス |
| セカンダリカテゴリ（任意） | 仕事効率化 |
| 著作権（Copyright） | `2026 株式会社Renaxis` |

**アプリ名の候補**（「名刺管理」単体は既存の可能性が高いので一意な名前に）:
- 名刺管理 Renaxis
- AI名刺スキャン - 名刺管理
- サッと名刺 - AI名刺管理

---

## 2. プロモーションテキスト（最大170字・審査なしで随時変更可）

```
撮って保存、AIが名刺を自動でデータ化。Google / LINE / Apple でかんたんログイン。増えていく名刺も、大切なご縁もスマートに整理できます。まずは無料で。
```

## 3. 概要（Description・最大4000字）

```
名刺管理アプリは、受け取った名刺をスマホで撮影するだけで、AIが会社名・氏名・連絡先を自動で読み取り、きれいに整理できる名刺管理アプリです。

■ 撮影するだけ、あとはAIにおまかせ
名刺をカメラで撮るだけで、文字認識（OCR）とAIが項目を自動で抽出。面倒な手入力を大きく減らします。読み取り結果は保存前に確認・修正できます。

■ 大切なご縁を、そのままデータに
氏名・フリガナ・会社名・部署・役職・メール・電話・住所・メモなどを構造化して保存。必要なときにすぐに探し出せます。

■ フォローアップもスマートに
商談後のお礼や連絡など、フォローアップの文面作成をサポートします。

■ かんたんログイン
Google / LINE / Apple（Sign in with Apple）ですぐに始められます。

■ こんな方におすすめ
・名刺が増えて管理に困っている方
・営業、フリーランス、経営者、個人事業主の方
・受け取った名刺を素早くデータ化したい方

無料で始められます。一部の機能は有料プランでご利用いただけます。

――――――――――
運営：株式会社Renaxis
お問い合わせ：info@renaxis.jp
プライバシーポリシー：https://business-card-manager-ruddy.vercel.app/policy
```

## 4. キーワード（最大100字・カンマ区切り・スペース不要）

```
名刺,名刺管理,名刺スキャン,名刺整理,OCR,人脈,営業,連絡先,ビジネス,AI名刺,名刺入れ,名刺アプリ,取引先
```

## 5. サポート・お問い合わせ

| 項目 | 内容 |
|---|---|
| サポートURL | `https://business-card-manager-ruddy.vercel.app/support` |
| お問い合わせメール | `info@renaxis.jp` |

---

## 6. バージョン情報（Version 1.0.0）

| 項目 | 内容 |
|---|---|
| バージョン番号 | 1.0.0 |
| このバージョンでの新機能（What's New） | 初回リリース。名刺の撮影・AI自動読み取り・整理・検索に対応しました。 |

---

## 7. 年齢制限（Age Rating）

質問票はすべて「なし／No」を選択 → **4+** になります。
（暴力・性的表現・ギャンブル・薬物等の該当なし。ユーザー生成コンテンツの共有機能や Web ブラウズ機能なし。）

---

## 8. App のプライバシー（App Privacy）— ここが審査で重要

**トラッキング：なし**（広告・第三者トラッキングに利用しません → 「データはあなたをトラッキングするために使用されません」）。

収集するデータ（すべて「ユーザーに紐づく／Linked to You」・「トラッキングには不使用」・目的は原則「App の機能」）:

| データ種別 | Apple分類 | 目的 | 紐づけ | 備考 |
|---|---|---|---|---|
| メールアドレス | Contact Info › Email Address | App の機能 | あり | ログイン用 |
| 氏名 | Contact Info › Name | App の機能 | あり | 表示名 |
| 写真（名刺画像） | User Content › Photos or Videos | App の機能 | あり | 有料機能で保存 |
| その他のユーザーコンテンツ（名刺のテキスト情報） | User Content › Other User Content | App の機能 | あり | 登録した連絡先情報 |
| ユーザーID | Identifiers › User ID | App の機能 | あり | 認証識別子 |
| 購入履歴 | Purchases › Purchase History | App の機能 | あり | サブスク状況 |
| 利用状況 | Usage Data › Product Interaction | App の機能 | あり | 操作ログ |
| （任意）診断・エラー情報 | Diagnostics › Crash/Other Diagnostic Data | App の機能 | あり | サーバーのエラーログ |

**申告しないもの**:
- クレジットカード番号等の決済情報 → iOSはApple社のApp内課金（In-App Purchase）で決済し、購読状態の管理に RevenueCat を利用（Web版は Stripe）。カード情報はApple/Stripeが取得し当社アプリは受け取らないため、開発者としては申告不要。
- 位置情報・連絡先（端末アドレス帳）・広告識別子（IDFA）→ 使用しません。

---

## 9. Sign in with Apple

- 第三者ログイン（Google / LINE）を提供しているため、**「Sign in with Apple」を必ず提供**します（実装済み）。
- App Store Connect 上で特別な設定は不要ですが、実機で Apple ログインが動作することを確認してください。

---

## 10. App 審査に関する情報（App Review Information）

**サインイン（Sign-In required）: はい**

**審査担当者向けメモ（Notes）** — そのままコピー可:
```
本アプリのログインは Google / LINE / Apple に対応しています。
審査担当者の方は、ログイン画面の「Sign in with Apple」からご自身のApple IDでログインしてご確認いただけます。
また、ログイン画面の「後でログイン」を選択すると、サンプルデータで主要機能（名刺の一覧・詳細・撮影/OCRのフロー）をログインなしでお試しいただけます。
名刺の登録では、端末のカメラまたは写真ライブラリから名刺画像を選択すると、OCRとAIが内容を自動抽出します。
お問い合わせ: info@renaxis.jp
```

**連絡先（Contact Information）**
| 項目 | 内容 |
|---|---|
| 名 / 姓 | 蓮 / 安藤 |
| メール | info@renaxis.jp |
| 電話番号 | ※要入力（App Review Information では電話番号が必須。会社の連絡可能な番号を入力してください） |

---

## 11. 輸出コンプライアンス（Export Compliance）

- 通信は標準的な暗号化（HTTPS/TLS）のみを使用 → 非該当（Exempt）。
- `Info.plist` に `ITSAppUsesNonExemptEncryption = NO` を設定しておくと、毎回の質問を省略できます（Rork/Expo 側の設定）。

---

## 12. 必要なアセット（別途準備）

- App アイコン 1024×1024 px（透過・角丸なしのPNG）
- スクリーンショット（必須）: 6.7インチ（iPhone 15 Pro Max 等）と 6.5インチ。iPad対応なら iPad 用も。各3〜10枚。
  - 推奨カット: ログイン画面 / 名刺一覧 / 名刺撮影・OCR / 名刺詳細 / フォローアップ
- （任意）App プレビュー動画

---

## ✅ 審査に出す直前の「必須対応チェックリスト」

- [ ] **【最重要・未実装】アカウント削除機能をアプリ内に追加する**
  - Apple ガイドライン **5.1.1(v)**：アカウント作成を伴うアプリは、**アプリ内でアカウントを削除できる導線が必須**です。メール依頼だけでは却下されます。
  - 現状、コード上にアカウント削除の実装が見当たりません。**このままでは却下される可能性が高い**です。
  - 対応：バックエンドに削除API（Supabaseの auth ユーザー＋profiles＋business_cards＋関連データを削除）を用意し、アプリの設定画面に「アカウントを削除」ボタンを追加する。→ 指示いただければバックエンド側APIはすぐ用意します（アプリ側ボタンはRorkで追加）。
- [ ] プライバシーポリシーURL / サポートURL が公開されている（→ 本対応で公開済み）
- [ ] 実機で Google / LINE / Apple の3ログインが通ることを確認
- [ ] Sign in with Apple が動作することを確認
- [ ] App アイコン・スクリーンショットを用意
- [ ] App Privacy（第8章）の申告がアプリの実挙動と一致していることを確認
- [ ] Info.plist のカメラ/写真ライブラリの利用目的説明（NSCameraUsageDescription / NSPhotoLibraryUsageDescription）が設定されている（Rork/Expo側）
- [ ] Export Compliance（ITSAppUsesNonExemptEncryption = NO）を設定
- [ ] App Review Information の電話番号を入力
