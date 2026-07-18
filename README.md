# サロン AI コンテンツツール

Instagram・ブログ・Googleビジネスプロフィール・ホットペッパービューティー向けコンテンツを一括生成するツールです。

## デプロイ手順（Vercel）

### 1. GitHubにアップロード

1. [github.com](https://github.com) にログイン
2. 右上「＋」→「New repository」をクリック
3. Repository name に `salon-ai-tool` と入力
4. 「Create repository」をクリック
5. 表示されるコマンドに従って、このフォルダをアップロード

```bash
cd salon-ai-tool
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/salon-ai-tool.git
git push -u origin main
```

### 2. Vercelにデプロイ

1. [vercel.com](https://vercel.com) にログイン
2. 「Add New Project」をクリック
3. GitHubから `salon-ai-tool` を選択して「Import」
4. そのまま「Deploy」をクリック
5. 数分でURLが発行されます 🎉

### 3. 友人に共有

発行されたURL（例：`https://salon-ai-tool.vercel.app`）を送るだけ！

友人は初回アクセス時にAnthropicのAPIキーを入力します。
APIキーは [console.anthropic.com](https://console.anthropic.com) で無料取得できます。

---

## 機能

- **Instagram投稿生成** - キャッチコピー・本文・ハッシュタグ25個
- **ブログ記事生成** - SEO対応の構成済み記事
- **Googleビジネスプロフィール** - 最新情報投稿テキスト
- **ホットペッパービューティー** - スタイルタイトル・説明文・タグ一式

## ローカルで動かす場合

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
