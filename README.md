# 自动记账项目

面向中文用户的 AI-first 共享记账和分账项目。

## 开始

当前轻量移动端 MVP 设计见：

- [Lightweight Mobile MVP Design](docs/superpowers/specs/2026-06-15-lightweight-mobile-mvp-design.md)
- [Stitch Design Notes](docs/design/stitch-design-notes.md)

早期完整方向文档见：

- [AI-first Shared Ledger Product Design](docs/superpowers/specs/2026-06-15-ai-first-shared-ledger-design.md)

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test:run
npm run typecheck
npm run build
npm audit --audit-level=high
```

## Environment

Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `EXCHANGE_RATE_PROVIDER_URL`, `EXCHANGE_RATE_PROVIDER_KEY`, and `OPENAI_API_KEY` from the provider dashboards. Do not commit real secrets.

`SUPABASE_SERVICE_ROLE_KEY` is only for backend/server functions. Never expose it in browser code.
