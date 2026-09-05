# 💬 お題生成器 (Conversation Starter)

[![Demo](https://img.shields.io/badge/🚀%20Demo-Live-black?style=flat-square&logo=vercel)][demo]
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)][demo]
[![Gemini API](https://img.shields.io/badge/Gemini%20API-Powered-4285F4?style=flat-square&logo=google&logoColor=white)][gemini]
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)][license]

Gemini APIを活用した、会話のきっかけや雑談・アイスブレイクに使えるお題を素早く生成するWebアプリケーションです。

---

## ✨ 1. 主な機能

- **💡 お題の自動生成**: 「生成！」ボタンを押すだけで、思わず話したくなるユニークなトークテーマを瞬時に生成します。
- **🔘 選択肢モード**: 「選択肢のみ」にチェックを入れることで、質問文と合わせてタップして選べる選択肢ボタン（複数択）を生成します。
- **🎯 ワード指定機能**: 気になる単語やキーワード（最大10文字）を指定し、そのワードを取り入れたお題を生成できます。
- **🤖 モデル選択**: 利用可能なGeminiモデル（Gemini Flash Lite等）を用途に合わせてプルダウンから選択可能です。

---

## 🌟 2. 特徴

- **🎨 柔軟なテーマ設定**: ライトモード、ダークモード、およびOSの設定に追従するシステムモードの3種に対応。
- **📱 PWA（Progressive Web App）完全対応**:
  - ホーム画面へのインストールが可能
  - 眩しさを抑えた落ち着いた起動スプラッシュ画面
  - アプリのテーマに合わせてシームレスに変化するステータスバー
- **⚡ 快適な操作性**: スマートフォン・タブレット・PC問わず美しくフィットするレスポンシブデザイン。

---

## ⚙️ 3. 開発情報

### 1) キャッシュのバージョン管理ルール

Service Worker (`sw.js`) で使用するキャッシュ名 (`CACHE_NAME`) は、以下の規則で運用しています。

`conversation-starter-YYYY.MM-rN`

- **YYYY** = 西暦 (例: 2026)
- **MM**   = 月 (01〜12)
- **rN**   = その月のリリース回数 (例: r1, r2...)

例: `conversation-starter-2026.09-r1`

ファイルの追加やロジック修正などのリリースを行う際は、このバージョン文字列をインクリメント・更新することで、ブラウザに保存された古いキャッシュを安全に破棄し、新しい資産を確実に反映させます。

---

## 🚀 4. 自分でホストする方法

本アプリはフロントエンド（静的ファイル）と、Gemini APIを呼び出すサーバーレス関数（`api/generate.js`）で構成されており、**Vercel Functionsの利用を前提**としています。そのため、`index.html` を単体で開いてもお題の生成機能（`/api/generate` 呼び出し）は動作しません。

### 1) 事前準備

- **Node.js 18.0.0 以上**:
  - `package.json` の `engines` フィールドで指定されています。本プロジェクトは `"type": "module"` のため、常にESモジュールとして読み込まれます
- **npm**
- **Gemini APIキー**:
  - [Google AI Studio][gemini] で発行できます
- **Vercel CLI**

### 2) 依存パッケージのインストール

`package.json` の依存関係は以下の通りです。

- `@google/genai`: Gemini APIを呼び出すための公式SDK
- `naughty-words`: ワード指定モードで使うNGワード辞書
  - `api/generate.js` はビルド成果物ではなく `node_modules/naughty-words/ja.json` を実行時に直接読み込んでいるため、このインストールは必須です。

### 3) 環境変数の設定（必須）

`api/generate.js` はサーバー側の環境変数 `GEMINI_API_KEY` を参照します。未設定の場合、生成ボタンを押すと「APIキーが設定されていません。」というエラーになります。

**ローカル開発の場合**:

プロジェクトルートに `.env.local` を作成します。

```plaintext
GEMINI_API_KEY=あなたのAPIキー
```

**Vercel本番環境の場合**:

Vercelのプロジェクトの設定から追加します。

> [!WARNING]
> `.env` / `.env.local` は**絶対にGitへコミットしない**でください。`.gitignore` への追加を推奨します。

### 4) ローカルでの起動

```bash
vercel dev
```

表示されたURL（例: `http://localhost:3000`）にアクセスして動作確認できます。`vercel dev` を使わずに単純な静的サーバー（`live-server` など）だけを立てた場合、画面は表示されますが生成を実行してもAPI呼び出しは失敗します。

### 5) 本番環境へのデプロイ

```bash
vercel --prod
```

またはGitHubリポジトリをVercelにインポートし、pushごとに自動デプロイする方法でも構いません。本リポジトリには `.vercel/project.json` が含まれているため既存のVercelプロジェクトに紐付いた状態です。フォークして別アカウントで使う場合は、先に以下でご自身のプロジェクトに紐付け直してください。

```bash
vercel link
```

### 6) その他の注意点

- `models.json` に定義されていないモデルIDを指定するとAPI側で拒否されます（ホワイトリスト方式）。使いたいモデルがある場合は `models.json` を編集してください。
- レート制限やアクセス制御は実装されていません。誰でもアクセスできる状態で公開運用する場合、Gemini APIの利用量課金に直結するため、必要に応じてご自身でリクエスト制限の実装を検討してください。
- Gemini API呼び出しは20秒でタイムアウトし、混雑時（503）は1回だけ自動リトライします。

---

## 🎨 5. カスタマイズ方法

自分でホストする場合、以下のファイルを編集することで挙動を変更できます。

### 5) `models.json`（モデル選択肢の変更）

トップの設定パネルに表示されるモデル一覧です。`group`（プルダウンのグループ名）ごとに `models` 配列を持ちます。

> [!NOTE]
> `models.json` はクライアント側（ブラウザ）では常に最新の内容がfetchされますが、サーバー側の `api/generate.js` はコールドスタート時（関数プロセス起動時）に一度だけ読み込んでホワイトリストを作ります。そのため、編集後は再起動をしないと、「プルダウンには出るのに生成しようとするとエラーになる」状態になります。

### 5) `api/prompts.json` / `api/questions.json`（生成の元ネタ）

いずれもサーバー側（`api/generate.js`）でのみ使われ、ユーザーには直接表示されません。AIに渡すプロンプトの「お手本・方向性」として使われるものです。

- `api/prompts.json`:
  - お題生成の方向性（例：「二者択一」「哲学的な問い」など）を指示するテンプレート文です。
  - `prompt` フィールドを増減・編集することで、生成されるお題の傾向を調整できます。
- `api/questions.json`:
  - AIへのfew-shotとして渡される質問サンプル集です。`choices` を持つ項目は「選択肢形式」、`answer_type: "text"` の項目は「自由記述形式」の例としてAIに提示されます。
  - ここに書いた質問がそのまま出力されるわけではなく、あくまで「こういう雰囲気のお題を作って」という参考例です。

<!-- defs -->

<!-- external -->
[demo]: https://conversation-starter-ten.vercel.app
[gemini]: https://ai.google.dev/

<!-- internal -->
[license]: LICENSE
