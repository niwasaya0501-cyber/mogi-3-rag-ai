# システムアーキテクチャ図

社内文書検索AI（RAG）の全体構成と、主要な2つの処理フロー（文書登録・質問応答）をまとめます。

## 全体構成図

```mermaid
flowchart TB
    subgraph Client["利用者"]
        Browser["社員のブラウザ"]
    end

    subgraph Vercel["Vercel (アプリ本体)"]
        NextApp["Next.js アプリ<br/>(社内文書検索AI)"]
        Middleware["認証ミドルウェア<br/>(Clerkセッション確認 + メールドメイン制限)"]
    end

    subgraph Auth["認証"]
        Clerk["Clerk<br/>(サインイン・ユーザー管理)"]
    end

    subgraph Storage["データ保存"]
        Blob["Vercel Blob<br/>(PDF原本・非公開)"]
        DB[("Neon Postgres + pgvector<br/>(文書メタデータ・検索用チャンク)")]
    end

    subgraph AI["AIモデル(Vercel AI Gateway経由)"]
        Embed["OpenAI<br/>text-embedding-3-small<br/>(埋め込み生成)"]
        LLM["Anthropic<br/>Claude Sonnet<br/>(回答生成)"]
    end

    Browser -->|HTTPS| NextApp
    NextApp --> Middleware
    Middleware -->|認証確認| Clerk

    NextApp -->|① PDFアップロード| Blob
    NextApp -->|② テキスト抽出→チャンク分割| Embed
    Embed -->|③ 埋め込みベクトル| DB

    NextApp -->|④ 質問| Embed
    NextApp -->|⑤ 類似チャンク検索| DB
    NextApp -->|⑥ 参考文書+質問| LLM
    LLM -->|⑦ 出典付き回答| NextApp
    NextApp -->|画面表示| Browser
```

## 技術構成

| レイヤー | 選定技術 |
|---|---|
| フロントエンド/バックエンド | Next.js (App Router) + TypeScript、Vercelにホスティング |
| 認証 | Clerk（メールドメイン制限をアプリ側に実装） |
| ファイルストレージ | Vercel Blob（PDF原本を非公開保存） |
| データベース | Neon Postgres + pgvector拡張（文書チャンクをベクトル検索） |
| AI（回答生成） | Anthropic Claude Sonnet（Vercel AI Gateway経由） |
| AI（埋め込み） | OpenAI text-embedding-3-small（Vercel AI Gateway経由） |
| PDFテキスト抽出 | unpdf |

## フロー①: 文書登録（管理者によるPDFアップロード）

```mermaid
sequenceDiagram
    actor Admin as 管理者
    participant App as Next.jsアプリ
    participant Blob as Vercel Blob
    participant Extract as PDFテキスト抽出(unpdf)
    participant Embed as 埋め込みAI(OpenAI)
    participant DB as Neon(pgvector)

    Admin->>App: PDFファイル + タイトルを送信
    App->>Blob: PDF原本を非公開保存
    App->>Extract: ページごとにテキスト抽出
    Extract->>App: 見出し(セクション)単位のテキスト
    App->>Embed: 各チャンクを埋め込みベクトルに変換
    Embed->>App: ベクトル配列
    App->>DB: 文書情報 + チャンク + ベクトルを保存
    App-->>Admin: 「取り込み完了: N個のチャンクを登録しました」
```

## フロー②: 質問応答（社員によるチャット利用）

```mermaid
sequenceDiagram
    actor User as 社員
    participant App as Next.jsアプリ
    participant Embed as 埋め込みAI(OpenAI)
    participant DB as Neon(pgvector)
    participant LLM as 生成AI(Claude Sonnet)

    User->>App: 質問文を送信
    App->>Embed: 質問文を埋め込みベクトルに変換
    Embed->>App: ベクトル配列
    App->>DB: ベクトル類似度で上位チャンクを検索
    DB->>App: 関連チャンク(文書名・ページ番号付き)
    App->>LLM: 質問 + 関連チャンクを渡して回答生成を依頼<br/>(文書にない内容は「見つかりません」と答えるよう指示)
    LLM-->>App: 出典付き回答(ストリーミング)
    App-->>User: 回答 + 出典(文書名・ページ番号)を画面表示
```

## 設計上のポイント

- **ハルシネーション対策**: LLMへの指示（システムプロンプト）で「参考文書にない内容は推測しない」ことを明示し、根拠のない回答を防止
- **出典の網羅性**: 同じ内容が複数文書にまたがる場合も、該当する文書すべてを出典として列挙するよう指示
- **検索精度**: PDFのテキストを「1ページ=1チャンク」ではなく、見出し(セクション)単位で分割することで、関連度の高いチャンクが検索結果の上位に来やすい設計
- **セキュリティ**: PDF原本は非公開ストレージに保存し公開URLを発行しない。全ルートを認証必須にし、許可メールドメイン以外はアクセス不可
