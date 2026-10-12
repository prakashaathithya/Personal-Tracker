# MoneyMap

Personal finance tracker — track expenses, monthly budgets, and loan/EMI schedules.

- **Frontend:** Angular 22 (`/web`)
- **Backend:** NestJS 11 API, deployed as a Vercel serverless function (`/api`)
- **Database + Auth:** Supabase (Postgres + Auth)
- **Hosting:** Vercel (single project — static SPA + `/api` function on the same origin)

## Project structure

```
/
├── web/            Angular frontend (built to web/dist/web/browser)
├── server/         NestJS modules, controllers, pure logic + its unit tests
├── api/
│   └── index.ts    Vercel serverless entry — bootstraps the Nest app from /server
├── supabase/
│   └── migrations/ Versioned schema changes (see its README)
├── package.json    npm workspaces root (web + server)
└── vercel.json     Vercel build + routing config
```

## Local development

```bash
npm ci               # installs both workspaces from the lockfile

npm run dev:api      # NestJS on http://localhost:3000  (routes under /api)
npm run dev:web      # Angular on http://localhost:4200
```

The Angular dev server proxies `/api` to the NestJS server (see `web/proxy.conf.json`).

## Tests

```bash
npm run test:api     # jest — pure logic: billing cycles, amortization, report
                     #        rollups, import dedupe, categorization rules
npm run test:web     # vitest
npm run lint:api     # eslint + prettier
```

CI (`.github/workflows/ci.yml`) runs lint, build and tests for both workspaces on
every push to `main` and every pull request.

## Dependencies

`package-lock.json` is committed, and CI and Vercel install with `npm ci`.

**Regenerating the lockfile needs care.** When a `node_modules/` tree is present,
npm resolves optional dependencies against the *current* platform, so a plain
`npm install` on Windows writes a lockfile holding only the win32 native binaries
— and `npm ci` on Vercel's Linux builder then fails on the missing ones. Generate
it where there is no `node_modules` instead:

```bash
mkdir /tmp/lockgen && cd /tmp/lockgen
mkdir web server
cp <repo>/package.json .
cp <repo>/web/package.json web/
cp <repo>/server/package.json server/
npm install --package-lock-only --ignore-scripts
cp package-lock.json <repo>/
```

Sanity check before committing — every native package should list both platforms:

```bash
grep -o '"node_modules/[^"]*\(win32\|linux\)[^"]*"' package-lock.json | sort -u
```

## Database

Schema lives in `supabase/migrations/` as versioned SQL files, applied through the
Supabase SQL editor. See [supabase/migrations/README.md](supabase/migrations/README.md)
for the apply procedure and what each migration does.

## Build

```bash
npm run build:web    # -> web/dist/web/browser
npm run build:api    # -> api/dist
```

## Deployment (Vercel)

Single Vercel project, root directory = repo root. `vercel.json` handles:
- `buildCommand` builds the Angular app
- `/api/*` requests are rewritten to the NestJS serverless function
- all other routes fall back to the Angular SPA (`index.html`)

Required environment variables (set in the Vercel dashboard):

| Variable | Used by | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | api | Supabase project URL |
| `SUPABASE_ANON_KEY` | api | Key every request-scoped client is built on |
| `CORS_ORIGIN` | api | Allowed frontend origin(s), comma-separated |
| `SUPABASE_SERVICE_ROLE_KEY` | api | Nightly job only — reads the list of user ids that own a card |
| `SUPABASE_JWT_SECRET` | api | Nightly job only — mints a short-lived token per user so the run stays under RLS |
| `CRON_SECRET` | api | Authenticates Vercel's scheduler; without it `/api/credit-cards/cron` returns 404 |
| `ANTHROPIC_API_KEY` | api | Assistant only. Without it `/api/chat` returns 503 and the rest of the app works as before |

## Scheduled work

`vercel.json` schedules `POST /api/credit-cards/cron` daily at 19:30 UTC (01:00 IST).
It generates any credit-card statement whose date has passed and raises the due,
overdue and utilisation alerts, so bills appear without anyone opening the app.

The same catch-up also runs on app load (`POST /credit-cards/run`). Both take a
short lease from `job_locks` first, so two tabs — or a tab and the nightly job —
can never generate the same bill twice; the caller that doesn't get the lease
returns `skipped: true`.

Recurring transactions are separate: they are materialized by `run_due_recurring()`
inside Postgres, on a pg_cron schedule (see the migrations).

Frontend (Angular) env values live in `web/src/environments/`.

## Assistant

The Assistant page answers questions about the signed-in user's finances with
Claude (`server/src/chat/`). It is retrieval over structured data rather than a
vector index: the model calls read-only tools (totals, breakdowns, transaction
search, balances, card bills, loans, goals, budget), and each tool queries
Supabase through the caller's RLS-scoped client and reuses the same aggregation
code as the dashboard. The model can never see another user's rows, and it
cannot write anything.

Replies stream to the browser as newline-delimited JSON from `POST /api/chat`.
That route is limited to 15 questions per minute per IP because each one costs
API tokens. Set `ANTHROPIC_API_KEY` in Vercel to turn it on.
