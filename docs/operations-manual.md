# 運用手順書 — 社内文書検索AI

このドキュメントは、本システムを日常運用する担当者（社内IT担当者を想定）向けの手順書です。

## 1. システム概要

社内マニュアル(PDF)を検索対象として取り込み、社員がチャットで質問すると出典(文書名・ページ番号)付きで回答するシステムです。アーキテクチャの詳細は [`architecture.md`](./architecture.md) を参照してください。

| 項目 | 内容 |
|---|---|
| 本番URL | https://mogi-3-rag-ai.vercel.app |
| リポジトリ | https://github.com/niwasaya0501-cyber/mogi-3-rag-ai （ブランチ: `worktree-mvp-foundation`） |
| ホスティング | Vercel |
| 管理者アップロード画面 | `/admin/upload` |
| チャット画面 | `/`（トップページ） |

## 2. 必要なアカウント・アクセス権限

運用担当者は以下のアカウントへのアクセスが必要です。

| サービス | 用途 | 権限 |
|---|---|---|
| Vercel | デプロイ・環境変数管理・ログ確認 | プロジェクトメンバー |
| GitHub | ソースコード管理 | リポジトリへの書き込み権限 |
| Clerk | サインインユーザー管理・認証設定 | Vercel経由でアクセス(「Manage in Vercel」ボタン) |
| Neon | データベースの直接確認(通常は不要) | Vercel Marketplace経由で自動連携 |

## 3. 日常運用: マニュアル(PDF)の追加

1. `/admin/upload` に管理者アカウントでサインイン
2. 「文書タイトル」に分かりやすい名前を入力(例: 「経費精算マニュアル」)
3. 「PDFファイル」欄でファイルを選択
4. 「取り込む」を押す
5. 「取り込み完了: N個のチャンクを登録しました」と表示されれば成功

**所要時間の目安**: PDFのページ数・混雑状況により数秒〜1分程度。

**注意点**:
- 同じ内容のPDFを重複してアップロードすると、チャット回答で同じ情報が複数回参照されることがあります。更新版を投入する場合は、先に古い文書を削除してから新しいものをアップロードしてください(削除方法は次項)。
- アップロード直後は画面から削除できません。削除は次項の手順（データベースを直接操作）で行います。

## 4. マニュアル(PDF)の削除・入れ替え

現時点(MVP)では削除専用の画面がないため、開発者に依頼してデータベースから直接削除するか、以下のスクリプトを実行します。

```bash
# プロジェクトディレクトリで実行(要 .env.local)。DELETE_TITLEに削除したい文書タイトルを指定する
DELETE_TITLE="削除したい文書名" node --env-file=.env.local -e '
import("@neondatabase/serverless").then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`DELETE FROM documents WHERE title = ${process.env.DELETE_TITLE} RETURNING title`;
  console.log(rows);
});
'
```

`documents`テーブルから削除すると、紐づく`chunks`(検索用データ)も自動的に削除されます(`ON DELETE CASCADE`設定済み)。Vercel Blobに保存された元のPDFファイルは別途`vercel blob del`コマンドで削除してください（残しておいても検索結果には影響しません）。

## 5. デプロイ手順(コード変更を反映する場合)

```bash
cd <プロジェクトディレクトリ>

# 1. 変更内容を確認
git status
git diff

# 2. コミット
git add <変更したファイル>
git commit -m "変更内容の説明"

# 3. GitHubへpush(バックアップ・履歴管理のため)
git push

# 4. Vercel本番へデプロイ
vercel --prod
```

デプロイ完了後、`https://mogi-3-rag-ai.vercel.app` にブラウザでアクセスし、サインイン→チャット→回答が正常に返ることを確認してください。

## 6. 環境変数一覧

Vercelダッシュボード（Settings → Environment Variables）または `vercel env ls` で確認・変更できます。

| 変数名 | 用途 | 発行元 |
|---|---|---|
| `DATABASE_URL` | データベース接続文字列 | Neon(Vercel Marketplace連携で自動発行) |
| `CLERK_SECRET_KEY` | 認証(サーバー側) | Clerk(Vercel Marketplace連携で自動発行) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 認証(ブラウザ側) | Clerk(同上) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | サインインページのURL | 手動設定(`/sign-in`) |
| `BLOB_READ_WRITE_TOKEN` | PDF原本の保存先 | Vercel Blob(ストア作成時に自動発行) |
| `ALLOWED_EMAIL_DOMAIN` | サインイン可能なメールドメイン制限 | 手動設定。本番では顧客企業の実ドメインに変更 |

いずれもVercelの環境変数として暗号化保存されており、**コードやGitリポジトリには含まれません**。

## 7. ログ・稼働状況の確認

```bash
# 直近のアクセスログ・エラーを確認
vercel logs https://mogi-3-rag-ai.vercel.app

# 特定のデプロイのビルドログを確認
vercel inspect <デプロイURL> --logs
```

Vercelダッシュボード(vercel.com)の「Observability」タブからも、リクエスト数・エラー率・レスポンスタイムをグラフで確認できます。

## 8. よくあるトラブルと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| チャットが「エラーが発生しました」で止まる | Vercel AI Gatewayの無料枠レート制限(`rate_limit_exceeded`、HTTP 429) | 30秒〜1分待って再試行。頻発する場合はVercel AI Gatewayに有料クレジットを追加 |
| サインインできない | `ALLOWED_EMAIL_DOMAIN`に設定したドメイン以外のメールアドレスを使用している | 許可ドメインのメールアドレスでサインインする、または`ALLOWED_EMAIL_DOMAIN`の設定を見直す |
| アップロードが「取り込み中...」のまま進まない | PDFが大きい、またはサーバーのコールドスタート(初回リクエストは時間がかかる) | 数十秒待つ。改善しない場合は`vercel logs`でエラーを確認 |
| チャットの回答が想定と違う・出典が漏れる | 検索結果の上位に関連チャンクが入っていない | `docs/architecture.md`の「検索精度」の仕組みを参照。文書の分量が増えてきた場合は検索件数(`topK`)の見直しを検討 |

## 9. 既知の制限事項(本番運用前に検討が必要な項目)

現在の実装は検証(MVP)段階のものであり、以下は本番の本格運用前に対応を検討してください。詳細は`README.md`の「本番運用に向けた検討事項」を参照。

- **AIモデル**: Vercel AI Gateway無料枠を使用中。利用者数が増えるとレート制限にかかりやすい
- **データベースの保存先**: 現在Neon(米国リージョン)。国内保存が必要な場合はSupabase等の東京リージョンへの移行が必要(Free Planでは東京リージョン非対応、Pro Plan以上が必要)
- **認証**: Clerkは開発用インスタンス(無料)のまま。本番の本格運用ではClerk本番インスタンスへの切り替えを推奨
- **メールドメイン制限**: Clerk公式のAllowlist機能(有料)ではなく、アプリ側のミドルウェアで簡易的に実装

## 10. 定期メンテナンス

- **依存パッケージの更新**: `npm outdated`で確認し、月1回程度`npm update`を実施。更新後は必ずローカルで動作確認してからデプロイ
- **APIキーのローテーション**: セキュリティポリシーに応じて、Clerk/Neon等のキーを定期的に再発行することを推奨
- **不要な文書の整理**: テスト用・重複した文書が残っていないか、`/admin/upload`で投入した文書一覧を定期的に確認

## 11. 問い合わせ・エスカレーション

システムに関する技術的な問題は、開発担当者へ連絡してください。連絡の際は以下を伝えるとスムーズです。

- 発生した操作(例: 「PDFをアップロードしようとした」)
- エラーメッセージ(画面のスクリーンショット推奨)
- 発生日時
