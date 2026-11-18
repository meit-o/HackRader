# HackRadar

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
