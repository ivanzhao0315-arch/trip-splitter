# 自动记账项目

面向中文用户的 AI-first 共享记账和分账项目。

## 开始

当前轻量移动端 MVP 设计见：

- [Lightweight Mobile MVP Design](docs/superpowers/specs/2026-06-15-lightweight-mobile-mvp-design.md)
- [Stitch Design Notes](docs/design/stitch-design-notes.md)

早期完整方向文档见：

- [AI-first Shared Ledger Product Design](docs/superpowers/specs/2026-06-15-ai-first-shared-ledger-design.md)

## Development

```bash
npm install
npm run dev -- --port 5178 --strictPort
```

## Quality Checks

```bash
npm run test:run
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Environment

Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `EXCHANGE_RATE_PROVIDER_URL`, `EXCHANGE_RATE_PROVIDER_KEY`, and `OPENAI_API_KEY` from the provider dashboards. If no exchange-rate provider is configured, the server uses the keyless `open.er-api.com` endpoint. `OPENAI_VISION_MODEL` controls the model used by screenshot/receipt parsing. Do not commit real secrets.

`SUPABASE_SERVICE_ROLE_KEY` is only for backend/server functions. Never expose it in browser code.

## Supabase Backend

To switch from local demo mode to a real shared backend, create a Supabase project, apply the migrations in `supabase/migrations/`, and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` in `.env.local`.

Detailed setup and verification steps are in [docs/supabase-setup.md](docs/supabase-setup.md).

## Cloudflare Pages Deployment

Production is deployed on Cloudflare Pages so `/api/exchange-rate` and `/api/ai-drafts` can run as Pages Functions.

Required Cloudflare Pages variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional server-side variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4.1-mini
EXCHANGE_RATE_PROVIDER_URL=
EXCHANGE_RATE_PROVIDER_KEY=
```

Deploy from a local build:

```bash
npm run build
npx wrangler pages deploy dist --project-name trip-splitter --branch main
```

GitHub Pages can host the static app, but it cannot run the `/api` functions used for AI drafts and exchange rates.
