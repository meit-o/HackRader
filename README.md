# HackRadar

### チーム開発の進捗を、見えるカタチに。

**HackRadar** は、ハッカソンやチーム開発における開発活動を可視化し、参加者・メンター・運営者をつなぐWebプラットフォームです。

GitHubと連携することで、コミットやPull Requestなどの開発活動を自動的に収集・分析し、チームの進捗や貢献度をわかりやすく表示します。

🌐公式サイト：(https://www.hackradar.dev)

## 🎯 開発背景

長期間にわたるハッカソンやチーム開発では、次のような課題があります。

- チームメンバーが今何を開発しているのかわからない
- 誰がどの程度開発に貢献しているのか把握しづらい
- メンターや運営者が各チームの進捗を確認するのに時間がかかる
- 開発が停滞しているチームを早期に発見しづらい

HackRadarは、こうした課題をGitHubの開発データを活用して解決することを目指しています。

## 🚀 主な機能

### 📊 GitHub活動の可視化

GitHub APIとWebhookを活用し、コミットやPull Requestなどの開発活動を取得します。

初回設定後は開発活動が自動的に反映されるため、参加者が手動で進捗を報告する負担を軽減します。

### 🏆 開発活動のポイント化

GitHub上での開発活動をポイントに変換し、個人やチームの貢献度を可視化します。

単純なコミット数だけでなく、ブランチを活用した開発、Pull Request、コードレビューなど、実際のチーム開発に近い行動を評価する仕組みを取り入れています。

### 👥 役割に応じたダッシュボード

- **参加者：** 自分やチームの活動状況、獲得ポイントを確認
- **メンター：** 担当チームの進捗を把握し、必要なサポートを提供
- **運営者：** 複数チームの開発状況を横断的に管理
- **審査員：** 開発活動を審査の参考情報として確認

### 💬 チームコミュニケーション

DMやHelpスレッドなどを通じて、参加者とメンター、運営者のコミュニケーションを支援します。

### 🔗 GitHubとの連携

GitHub OAuthによる認証やWebhook連携に対応しています。また、GitHub Organization内でのリポジトリ作成にも対応し、開発開始から進捗管理までをサポートします。

## 🛠 技術スタック

| 分類           | 使用技術             |
| -------------- | -------------------- |
| フレームワーク | Next.js              |
| 言語           | TypeScript           |
| ORM            | TypeORM              |
| データベース   | PostgreSQL（Neon）   |
| 認証           | GitHub OAuth         |
| 外部連携       | GitHub API / Webhook |
| ホスティング   | Vercel               |
| DNS            | Cloudflare           |

## 💡 HackRadarが目指すもの

HackRadarは、単なるGitHubの活動集計ツールではありません。

「誰がどれだけコードを書いたか」だけでなく、「チームがどのように開発を進めているか」を可視化することを重視しています。

さらに、Pull Requestの作成やコードレビューなど、チーム開発において重要な行動を高く評価するポイント制度を導入しています。

これにより、参加者がポイント獲得を楽しみながら、適切なGitHubの運用やチームメンバーとの協力を自然と習慣化できる環境を目指しています。

参加者には開発を続けるモチベーションを、メンターには適切なサポートのきっかけを、運営者には効率的な進捗管理の仕組みを提供します。

開発の過程そのものが評価され、チーム全体の成長につながる環境を目指しています。

## 🌐 サービス

**HackRadar：** [https://www.hackradar.dev](https://www.hackradar.dev)


# HackRadar eng ver

Hackathon team dashboard. GitHub activity feeds team scores and activity timelines; participants, mentors, organizers, and judges have separate views. Help threads, staff chat, private direct messages, and optional WakaTime summaries are included.

## Stack

- Next.js App Router and TypeScript
- PostgreSQL accessed through TypeORM
- Versioned TypeORM migrations; schema synchronization is disabled
- GitHub OAuth and signed GitHub webhooks
- Private DM image attachments stored as PostgreSQL bytea values
- Vercel for the Next.js web service and Neon PostgreSQL for production

Live GitHub activity updates use an authenticated WebSocket and Upstash Redis Pub/Sub to notify dashboards after webhook data is saved. The browser reloads its event-scoped state snapshot after a notification; it never connects directly to PostgreSQL.

## Local setup

Install PostgreSQL locally (listening on port `5432`) and Node.js 22.12 or newer within the 22.x release line (see `.nvmrc` and `package.json`). Create a database named `hackradar`, then in the repository root:

```sh
npm ci
Copy-Item .env.example .env.local
vercel link
```

Install Vercel CLI 54.14.2 or later (`npm i -g vercel`) and link the project first. Vercel's WebSocket upgrade API is not available with `next dev`. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` and in the Vercel project.

Edit `DATABASE_URL` in `.env.local` with your local PostgreSQL username and password. For example: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/hackradar`. If your password contains URL-reserved characters, percent-encode them. `DATABASE_SSL=false` is correct for local PostgreSQL. Open http://localhost:3000. TypeORM creates the schema on the first database request.

To connect GitHub OAuth locally, create a GitHub OAuth App with callback `http://localhost:3000/api/auth/github/callback` and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `AUTH_SECRET` in `.env.local`. Demo mode is enabled locally by default; set `ENABLE_DEMO_MODE=false` when using the actual event flow.

Start the Vercel development server with `npm run dev:vercel` after setting the database, Redis, and optional OAuth variables.

## Deploy to Vercel and Neon

Import this repository into Vercel, then install the Neon PostgreSQL integration from the Vercel Marketplace. Map the integration's pooled connection string to `DATABASE_URL`; TypeORM applies pending migrations when the application first connects. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` alongside GitHub OAuth, webhook, WakaTime, and `AUTH_SECRET` variables. For the complete setup, callback URLs, local PostgreSQL, and data migration steps, see [DEPLOY.md](./DEPLOY.md).

## Migrate existing records

The app has no runtime Supabase dependency. To preserve data from the previous deployment, use the one-time TypeORM importer in `scripts/migrate-supabase-data.cjs`, before switching traffic. It copies app records and private DM image files. The source-only credentials are documented in [DEPLOY.md](./DEPLOY.md); do not add them to Render.

## Useful commands

```sh
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm run verify:core
npm run verify:flow
```

`npm run dev` invokes `next dev` for ordinary local development. To exercise WebSocket updates, use `npm run dev:vercel` (the Vercel CLI `vc dev` command).

`GET /api/health` checks PostgreSQL connectivity and applies pending migrations.
