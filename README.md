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
├── api/
│   ├── index.ts    Vercel serverless entry — bootstraps the Nest app
│   └── src/        NestJS modules, controllers, services
├── package.json    npm workspaces root (web + api)
└── vercel.json     Vercel build + routing config
```

## Local development

```bash
npm install          # installs both workspaces

npm run dev:api      # NestJS on http://localhost:3000  (routes under /api)
npm run dev:web      # Angular on http://localhost:4200
```

The Angular dev server proxies `/api` to the NestJS server (see `web/proxy.conf.json`).

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
| `SUPABASE_SERVICE_ROLE_KEY` | api | Server-side DB access |
| `SUPABASE_JWT_SECRET` | api | Verify auth tokens from the frontend |
| `CORS_ORIGIN` | api | Allowed frontend origin(s), comma-separated |
| `DATABASE_URL` | api | Pooled Postgres connection string |

Frontend (Angular) env values live in `web/src/environments/`.
