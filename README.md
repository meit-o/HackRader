# HackRadar

Hackathon team dashboard. GitHub activity feeds team scores and activity timelines; participants, mentors, organizers, and judges have separate views. Help threads, staff chat, private direct messages, and optional WakaTime summaries are included.

## Stack

- Next.js App Router and TypeScript
- PostgreSQL accessed through TypeORM
- Versioned TypeORM migrations; schema synchronization is disabled
- GitHub OAuth and signed GitHub webhooks
- Private DM image attachments stored as PostgreSQL bytea values
- Render Node web service and Render PostgreSQL for production

Live dashboard updates use API polling. The browser does not connect directly to the database.

## Local setup

Install PostgreSQL locally (listening on port `5432`) and Node.js 20.9 or newer. Create a database named `hackradar`, then in the repository root:

```sh
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Edit `DATABASE_URL` in `.env.local` with your local PostgreSQL username and password. For example: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/hackradar`. If your password contains URL-reserved characters, percent-encode them. `DATABASE_SSL=false` is correct for local PostgreSQL. Open http://localhost:3000. TypeORM creates the schema on the first database request.

To connect GitHub OAuth locally, create a GitHub OAuth App with callback `http://localhost:3000/api/auth/github/callback` and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `AUTH_SECRET` in `.env.local`. Demo mode is enabled locally by default; set `ENABLE_DEMO_MODE=false` when using the actual event flow.

## Deploy to Render

Create a Render Blueprint from this repository and review its web service and persistent PostgreSQL plan. Set GitHub OAuth and webhook secrets in the Render dashboard. The Blueprint provides `DATABASE_URL` through Render's private network. For step-by-step setup, OAuth callback and webhook URLs, local PostgreSQL, and data migration, see [DEPLOY.md](./DEPLOY.md).

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

`GET /api/health` checks PostgreSQL connectivity and applies pending migrations.
