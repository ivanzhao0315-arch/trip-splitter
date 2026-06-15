# Supabase Backend Setup

This project can run in two modes:

- Without `.env.local`: local demo mode, persisted only in browser `localStorage`.
- With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: shared Supabase mode, usable by multiple people through the same 4-character project code.

## Access Model

The MVP intentionally has no login. Anyone who knows a project code can join the project and collaborate.

Because there is no authenticated user identity yet, the Supabase policies in `0006_public_mvp_policies.sql` allow the browser `anon` role to read and write the MVP tables. This is acceptable for a share-by-code prototype, but it is not private-account security. Before storing sensitive financial data, add authentication or per-project access tokens and replace these public policies.

## 1. Create The Supabase Project

1. Open the Supabase dashboard.
2. Create a new project.
3. In `Project Settings -> API`, copy:
   - Project URL
   - anon public key
4. Do not put the service role key in browser code.

## 2. Apply The Database Schema

Open `SQL Editor` in Supabase and run the migration files in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_project_context.sql`
3. `supabase/migrations/0003_unique_project_member_names.sql`
4. `supabase/migrations/0004_settlement_snapshot_period_label.sql`
5. `supabase/migrations/0005_expense_source_name.sql`
6. `supabase/migrations/0006_public_mvp_policies.sql`
7. `supabase/migrations/0007_supporting_fk_indexes.sql`

If you prefer the Supabase CLI, install or run it with `npx`, link the project, then push migrations:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## 3. Configure Local Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Fill at least:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Optional server-side integrations:

```bash
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4.1-mini
EXCHANGE_RATE_PROVIDER_URL=
EXCHANGE_RATE_PROVIDER_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is only for trusted backend scripts or serverless functions. Never expose it through `VITE_` variables.

## 4. Run The App Against Supabase

```bash
npm install
npm run dev -- --port 5178 --strictPort
```

Open `http://localhost:5178`.

## 5. Verify Multi-User Persistence

Use two browser profiles, or one normal window plus one incognito window.

1. In window A, enter a nickname and create a project.
2. Copy the project invitation from the top project code or the settings panel.
3. In window B, enter a different nickname and join with the same 4-character project code.
4. Add a manual expense in either window.
5. Refresh both windows.
6. Confirm members, expenses, current period, and settlement history persist.

Expected result: both windows load the same Supabase-backed project state. If `.env.local` is missing or has empty Supabase variables, this test only verifies local browser storage.

## 6. Quick SQL Checks

After testing, these queries should show rows:

```sql
select code, name, default_currency, project_type, created_at
from public.projects
order by created_at desc
limit 5;

select p.code, m.display_name, m.joined_at
from public.members m
join public.projects p on p.id = m.project_id
order by m.joined_at desc
limit 10;

select p.code, e.description, e.original_amount_minor, e.original_currency, e.created_at
from public.expenses e
join public.projects p on p.id = e.project_id
order by e.created_at desc
limit 10;
```

## Production Notes

- The 4-character project code is a collaboration convenience, not a strong secret.
- For public testing, this MVP can be deployed with only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- For real users, add authentication or project access tokens before collecting sensitive data.
- Keep AI and exchange-rate provider keys in server-side deployment environment variables only.
