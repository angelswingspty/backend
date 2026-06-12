# GHRI Backend API

TypeScript + Fastify API server for the GHRI Foundation platform. Replaces the legacy Express server from `Global-Health-Equity`.

## Stack

- **Fastify 5** — HTTP server
- **Drizzle ORM** — PostgreSQL access (schema ported from legacy monorepo)
- **Zod** — environment validation
- **Pino** — structured logging

## Quick start

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate   # requires Postgres running
npm run dev
```

The API listens on `http://localhost:8080` with routes under `/api/*`.

Health check: `GET http://localhost:8080/api/healthz`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default `8080`) |
| `HOST` | No | Bind address (default `0.0.0.0`) |
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `LOG_LEVEL` | No | Pino log level (default `info`) |
| `SESSION_SECRET` | Prod | 32+ char secret for JWT/crypto |
| `ALLOWED_ORIGINS` | Prod | Comma-separated CORS origins |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled server |
| `npm run typecheck` | Typecheck without emit |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:push` | Push schema directly (dev only) |

## Project layout

```
src/
  config/env.ts       # Zod-validated environment
  db/                 # Drizzle client + schema
  plugins/            # Fastify plugins (database, security)
  routes/             # Route modules registered under /api
  lib/logger.ts
  app.ts              # Fastify app factory
  index.ts            # Entry point
openapi.yaml          # API contract (from legacy monorepo)
drizzle/              # SQL migrations
```

## Frontend integration

Point the Next.js app at this server:

```env
# ghrif/.env.local
API_URL=http://localhost:8080
```

Next.js rewrites `/api/*` to the backend.

## Route porting status

See the route map in `src/routes/index.ts`. Only `/api/healthz` is implemented so far — remaining routes from `openapi.yaml` will be ported module by module.
# backend
