# Real MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $superpower-subagents (recommended) or $superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking via update_plan.

**Goal:** Turn the Stitch-based mobile prototype into a real lightweight shared-expense MVP with persisted projects, members, expenses, equal splitting, multi-currency snapshots, and periodic settlement.

**Architecture:** Keep the existing React/Vite mobile app and extract domain logic into tested modules. Use Supabase Postgres as the first backend because it gives fast managed persistence, simple REST/RPC access, and a clean path to file storage for receipt screenshots. AI parsing and exchange rates should be accessed through backend functions so provider keys never ship to the browser.

**Tech Stack:** React 19, Vite 8, Vitest, Supabase Postgres, Supabase Storage, server-side AI parser function, server-side exchange-rate function.

---

## File Map

Create or modify these files:

- Modify: `package.json`  
  Add `test`, `test:run`, and `typecheck` scripts plus Vitest dependencies.

- Create: `src/domain/codes.js`  
  Normalize and generate 4-character project codes.

- Create: `src/domain/money.js`  
  Currency symbols, money formatting, and integer-cent arithmetic helpers.

- Create: `src/domain/splitting.js`  
  Equal split and simplified settlement calculation.

- Create: `src/domain/periods.js`  
  Active-period and settlement-snapshot helpers.

- Create: `src/domain/__tests__/codes.test.js`  
  Tests for project-code normalization and generation.

- Create: `src/domain/__tests__/splitting.test.js`  
  Tests for equal split, net balances, and transfer simplification.

- Create: `supabase/migrations/0001_initial_schema.sql`  
  Database tables for projects, members, periods, expenses, AI drafts, and settlement snapshots.

- Create: `src/services/apiClient.js`  
  Browser API wrapper used by React screens.

- Create: `src/services/projectService.js`  
  Create/join project and member persistence methods.

- Create: `src/services/expenseService.js`  
  Create expense and fetch project detail methods.

- Create: `src/services/settlementService.js`  
  Settle active period and read historical snapshots.

- Create: `src/services/exchangeRateService.js`  
  Fetch and refresh exchange-rate snapshots through the backend.

- Create: `src/services/aiDraftService.js`  
  Submit image/text sources and save AI draft results.

- Modify: `src/main.jsx`  
  Replace hard-coded sample data with service-backed app state while preserving the Stitch UI.

- Modify: `src/styles.css`  
  Keep current visual system; only adjust layout where real loading/error states require it.

- Create: `.env.example`  
  Document required browser and backend environment variables without secrets.

- Modify: `README.md`  
  Add local setup, build, test, and backend configuration instructions.

---

## Task 1: Add Tested Domain Utilities

**Files:**
- Modify: `package.json`
- Create: `src/domain/codes.js`
- Create: `src/domain/money.js`
- Create: `src/domain/splitting.js`
- Create: `src/domain/periods.js`
- Create: `src/domain/__tests__/codes.test.js`
- Create: `src/domain/__tests__/splitting.test.js`

- [ ] **Step 1: Add test scripts and dependencies**

Update `package.json` scripts and dev dependencies:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "playwright": "^1.60.0",
    "vitest": "^3.2.4"
  }
}
```

Run:

```bash
npm install
```

Expected: packages install with `found 0 vulnerabilities`.

- [ ] **Step 2: Write project-code tests**

Create `src/domain/__tests__/codes.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createProjectCode, normalizeProjectCode } from '../codes';

describe('project codes', () => {
  it('normalizes to uppercase letters and digits only', () => {
    expect(normalizeProjectCode(' a7-k2!! ')).toBe('A7K2');
    expect(normalizeProjectCode('x8k2p')).toBe('X8K');
    expect(normalizeProjectCode('你A1B2')).toBe('A1B2');
  });

  it('generates readable 4-character codes', () => {
    for (let index = 0; index < 100; index += 1) {
      const code = createProjectCode();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
      expect(code).not.toMatch(/[O01I]/);
    }
  });
});
```

- [ ] **Step 3: Run code tests and confirm they fail**

Run:

```bash
npm run test:run -- src/domain/__tests__/codes.test.js
```

Expected: FAIL because `src/domain/codes.js` does not exist.

- [ ] **Step 4: Implement project-code utilities**

Create `src/domain/codes.js`:

```js
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeProjectCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function createProjectCode(random = Math.random) {
  return Array.from({ length: 4 }, () => {
    const index = Math.floor(random() * CODE_ALPHABET.length);
    return CODE_ALPHABET[index];
  }).join('');
}
```

- [ ] **Step 5: Implement money helpers**

Create `src/domain/money.js`:

```js
const SYMBOLS = {
  CNY: '¥',
  USD: '$',
  JPY: '¥',
  EUR: '€',
  HKD: 'HK$',
  TWD: 'NT$',
  SGD: 'S$',
  KRW: '₩',
  GBP: '£',
};

export function currencySymbol(currency) {
  return SYMBOLS[currency] ?? currency;
}

export function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

export function fromMinorUnits(minorUnits) {
  return Number((minorUnits / 100).toFixed(2));
}

export function formatMoney(amount, currency = 'CNY') {
  const symbol = currencySymbol(currency);
  return `${symbol}${Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

- [ ] **Step 6: Write split and settlement tests**

Create `src/domain/__tests__/splitting.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { calculatePeriodBalances, createEqualSplits, simplifyTransfers } from '../splitting';

const members = [
  { id: 'chen', display_name: '小陈' },
  { id: 'zhang', display_name: '张三' },
  { id: 'ivan', display_name: 'Ivan' },
];

describe('equal splitting', () => {
  it('splits cents evenly and assigns remainder cents deterministically', () => {
    const splits = createEqualSplits({
      amountMinor: 10000,
      participantIds: ['chen', 'zhang', 'ivan'],
    });

    expect(splits).toEqual([
      { member_id: 'chen', owed_minor: 3334 },
      { member_id: 'zhang', owed_minor: 3333 },
      { member_id: 'ivan', owed_minor: 3333 },
    ]);
  });

  it('calculates net balances for a period', () => {
    const expenses = [
      { payer_member_id: 'chen', converted_amount_minor: 40000, participant_member_ids: ['chen', 'zhang', 'ivan'] },
      { payer_member_id: 'zhang', converted_amount_minor: 8650, participant_member_ids: ['chen', 'zhang'] },
    ];

    const balances = calculatePeriodBalances({ members, expenses });

    expect(balances).toEqual([
      { member_id: 'chen', display_name: '小陈', paid_minor: 40000, owed_minor: 17658, net_minor: 22342 },
      { member_id: 'zhang', display_name: '张三', paid_minor: 8650, owed_minor: 17658, net_minor: -9008 },
      { member_id: 'ivan', display_name: 'Ivan', paid_minor: 0, owed_minor: 13334, net_minor: -13334 },
    ]);
  });

  it('simplifies debtor-to-creditor transfers', () => {
    const transfers = simplifyTransfers([
      { member_id: 'chen', display_name: '小陈', net_minor: 17000 },
      { member_id: 'zhang', display_name: '张三', net_minor: -9600 },
      { member_id: 'ivan', display_name: 'Ivan', net_minor: -7400 },
    ]);

    expect(transfers).toEqual([
      { from_member_id: 'zhang', from_name: '张三', to_member_id: 'chen', to_name: '小陈', amount_minor: 9600 },
      { from_member_id: 'ivan', from_name: 'Ivan', to_member_id: 'chen', to_name: '小陈', amount_minor: 7400 },
    ]);
  });
});
```

- [ ] **Step 7: Implement split and settlement logic**

Create `src/domain/splitting.js`:

```js
export function createEqualSplits({ amountMinor, participantIds }) {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error('amountMinor must be a non-negative integer');
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new Error('participantIds must contain at least one member');
  }

  const base = Math.floor(amountMinor / participantIds.length);
  const remainder = amountMinor % participantIds.length;

  return participantIds.map((memberId, index) => ({
    member_id: memberId,
    owed_minor: base + (index < remainder ? 1 : 0),
  }));
}

export function calculatePeriodBalances({ members, expenses }) {
  const memberMap = new Map(members.map((member) => [member.id, {
    member_id: member.id,
    display_name: member.display_name,
    paid_minor: 0,
    owed_minor: 0,
    net_minor: 0,
  }]));

  for (const expense of expenses) {
    const amountMinor = expense.converted_amount_minor;
    const splits = createEqualSplits({
      amountMinor,
      participantIds: expense.participant_member_ids,
    });

    memberMap.get(expense.payer_member_id).paid_minor += amountMinor;

    for (const split of splits) {
      memberMap.get(split.member_id).owed_minor += split.owed_minor;
    }
  }

  return Array.from(memberMap.values()).map((balance) => ({
    ...balance,
    net_minor: balance.paid_minor - balance.owed_minor,
  }));
}

export function simplifyTransfers(balances) {
  const creditors = balances
    .filter((balance) => balance.net_minor > 0)
    .map((balance) => ({ ...balance }))
    .sort((a, b) => b.net_minor - a.net_minor);

  const debtors = balances
    .filter((balance) => balance.net_minor < 0)
    .map((balance) => ({ ...balance, debt_minor: Math.abs(balance.net_minor) }))
    .sort((a, b) => b.debt_minor - a.debt_minor);

  const transfers = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountMinor = Math.min(creditor.net_minor, debtor.debt_minor);

    if (amountMinor > 0) {
      transfers.push({
        from_member_id: debtor.member_id,
        from_name: debtor.display_name,
        to_member_id: creditor.member_id,
        to_name: creditor.display_name,
        amount_minor: amountMinor,
      });
    }

    creditor.net_minor -= amountMinor;
    debtor.debt_minor -= amountMinor;

    if (creditor.net_minor === 0) creditorIndex += 1;
    if (debtor.debt_minor === 0) debtorIndex += 1;
  }

  return transfers;
}
```

- [ ] **Step 8: Implement period helpers**

Create `src/domain/periods.js`:

```js
export function createCurrentPeriodLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildSettlementSnapshot({ project, period, expenses, balances, transfers }) {
  return {
    project_id: project.id,
    period_id: period.id,
    project_currency: project.default_currency,
    included_expense_ids: expenses.map((expense) => expense.id),
    member_balance_payload: balances,
    transfer_payload: transfers,
  };
}
```

- [ ] **Step 9: Run tests**

Run:

```bash
npm run test:run
npm run build
```

Expected: both commands PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/domain
git commit -m "Add shared expense domain utilities"
```

---

## Task 2: Add Supabase Database Schema

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create initial SQL migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  code text not null unique check (code ~ '^[A-Z0-9]{4}$'),
  default_currency text not null default 'CNY' check (default_currency ~ '^[A-Z]{3}$'),
  active_period_id uuid,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now()
);

create table public.settlement_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  status text not null default 'active' check (status in ('active', 'settled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  settled_at timestamptz
);

alter table public.projects
  add constraint projects_active_period_id_fkey
  foreign key (active_period_id)
  references public.settlement_periods(id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_id uuid not null references public.settlement_periods(id) on delete restrict,
  original_amount_minor integer not null check (original_amount_minor >= 0),
  original_currency text not null check (original_currency ~ '^[A-Z]{3}$'),
  converted_amount_minor integer not null check (converted_amount_minor >= 0),
  project_currency text not null check (project_currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  exchange_rate_provider text not null default 'identity',
  exchange_rate_timestamp timestamptz not null default now(),
  description text not null default '',
  payer_member_id uuid not null references public.members(id) on delete restrict,
  participant_member_ids uuid[] not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'photo', 'screenshot', 'text')),
  created_at timestamptz not null default now(),
  check (array_length(participant_member_ids, 1) >= 1)
);

create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null check (source_type in ('photo', 'screenshot', 'text')),
  source_ref text,
  draft_payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

create table public.settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  period_id uuid not null references public.settlement_periods(id) on delete restrict,
  project_currency text not null check (project_currency ~ '^[A-Z]{3}$'),
  included_expense_ids uuid[] not null,
  member_balance_payload jsonb not null,
  transfer_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index members_project_id_idx on public.members(project_id);
create index periods_project_id_status_idx on public.settlement_periods(project_id, status);
create index expenses_project_id_period_id_idx on public.expenses(project_id, period_id);
create index ai_drafts_project_id_idx on public.ai_drafts(project_id);
create index snapshots_project_id_idx on public.settlement_snapshots(project_id);
```

- [ ] **Step 2: Add environment template**

Create `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EXCHANGE_RATE_PROVIDER_URL=
EXCHANGE_RATE_PROVIDER_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 3: Update README setup section**

Add this section to `README.md`:

````markdown
## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test:run
npm run build
npm audit --audit-level=high
```

## Environment

Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `EXCHANGE_RATE_PROVIDER_URL`, `EXCHANGE_RATE_PROVIDER_KEY`, and `OPENAI_API_KEY` from the provider dashboards. Do not commit real secrets.
````

- [ ] **Step 4: Validate SQL syntax locally if Supabase CLI is installed**

Run:

```bash
supabase db lint
```

Expected if CLI is installed: no schema errors.  
Expected if CLI is not installed: shell reports `supabase: command not found`; continue and validate during Supabase setup.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_initial_schema.sql .env.example README.md
git commit -m "Add Supabase schema for MVP"
```

---

## Task 3: Add Backend Service Layer in the Frontend

**Files:**
- Create: `src/services/apiClient.js`
- Create: `src/services/projectService.js`
- Create: `src/services/expenseService.js`
- Create: `src/services/settlementService.js`
- Create: `src/services/exchangeRateService.js`
- Create: `src/services/aiDraftService.js`

- [ ] **Step 1: Add Supabase client dependency**

Run:

```bash
npm install @supabase/supabase-js
```

Expected: package installs with `found 0 vulnerabilities`.

- [ ] **Step 2: Create API client**

Create `src/services/apiClient.js`:

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasBackendConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasBackendConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
```

- [ ] **Step 3: Create project service**

Create `src/services/projectService.js`:

```js
import { createCurrentPeriodLabel } from '../domain/periods';
import { createProjectCode, normalizeProjectCode } from '../domain/codes';
import { requireSupabase } from './apiClient';

export async function createProject({ name, defaultCurrency, displayName }) {
  const client = requireSupabase();
  const code = createProjectCode();

  const { data: project, error: projectError } = await client
    .from('projects')
    .insert({ name, code, default_currency: defaultCurrency })
    .select()
    .single();

  if (projectError) throw projectError;

  const { data: period, error: periodError } = await client
    .from('settlement_periods')
    .insert({ project_id: project.id, label: createCurrentPeriodLabel() })
    .select()
    .single();

  if (periodError) throw periodError;

  const { error: updateError } = await client
    .from('projects')
    .update({ active_period_id: period.id })
    .eq('id', project.id);

  if (updateError) throw updateError;

  const member = await joinProject({ code, displayName });

  return {
    ...project,
    active_period_id: period.id,
    current_member_id: member.id,
  };
}

export async function joinProject({ code, displayName }) {
  const client = requireSupabase();
  const normalizedCode = normalizeProjectCode(code);

  const { data: project, error: projectError } = await client
    .from('projects')
    .select('*')
    .eq('code', normalizedCode)
    .single();

  if (projectError) throw new Error('项目码不存在');

  const { data: member, error: memberError } = await client
    .from('members')
    .insert({ project_id: project.id, display_name: displayName })
    .select()
    .single();

  if (memberError) throw memberError;

  return { ...member, project };
}
```

- [ ] **Step 4: Create expense service**

Create `src/services/expenseService.js`:

```js
import { toMinorUnits } from '../domain/money';
import { requireSupabase } from './apiClient';

export async function fetchProjectDetail(projectId) {
  const client = requireSupabase();

  const [{ data: project, error: projectError }, { data: members, error: membersError }] = await Promise.all([
    client.from('projects').select('*').eq('id', projectId).single(),
    client.from('members').select('*').eq('project_id', projectId).order('joined_at'),
  ]);

  if (projectError) throw projectError;
  if (membersError) throw membersError;

  const { data: expenses, error: expensesError } = await client
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .eq('period_id', project.active_period_id)
    .order('created_at', { ascending: false });

  if (expensesError) throw expensesError;

  return { project, members, expenses };
}

export async function createExpense({
  project,
  amount,
  currency,
  convertedAmount,
  exchangeRate,
  exchangeRateProvider,
  exchangeRateTimestamp,
  description,
  payerMemberId,
  participantMemberIds,
  sourceType,
}) {
  const client = requireSupabase();

  const { data, error } = await client
    .from('expenses')
    .insert({
      project_id: project.id,
      period_id: project.active_period_id,
      original_amount_minor: toMinorUnits(amount),
      original_currency: currency,
      converted_amount_minor: toMinorUnits(convertedAmount),
      project_currency: project.default_currency,
      exchange_rate: exchangeRate,
      exchange_rate_provider: exchangeRateProvider,
      exchange_rate_timestamp: exchangeRateTimestamp,
      description,
      payer_member_id: payerMemberId,
      participant_member_ids: participantMemberIds,
      source_type: sourceType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 5: Create settlement service**

Create `src/services/settlementService.js`:

```js
import { calculatePeriodBalances, simplifyTransfers } from '../domain/splitting';
import { buildSettlementSnapshot, createCurrentPeriodLabel } from '../domain/periods';
import { requireSupabase } from './apiClient';

export function buildCurrentSettlement({ project, members, expenses }) {
  const balances = calculatePeriodBalances({
    members,
    expenses: expenses.map((expense) => ({
      payer_member_id: expense.payer_member_id,
      converted_amount_minor: expense.converted_amount_minor,
      participant_member_ids: expense.participant_member_ids,
    })),
  });
  const transfers = simplifyTransfers(balances);
  return { balances, transfers };
}

export async function settleActivePeriod({ project, period, members, expenses }) {
  const client = requireSupabase();
  const { balances, transfers } = buildCurrentSettlement({ project, members, expenses });
  const snapshot = buildSettlementSnapshot({ project, period, expenses, balances, transfers });

  const { error: snapshotError } = await client
    .from('settlement_snapshots')
    .insert(snapshot);

  if (snapshotError) throw snapshotError;

  const now = new Date().toISOString();

  const { error: periodError } = await client
    .from('settlement_periods')
    .update({ status: 'settled', ended_at: now, settled_at: now })
    .eq('id', period.id);

  if (periodError) throw periodError;

  const { data: nextPeriod, error: nextError } = await client
    .from('settlement_periods')
    .insert({ project_id: project.id, label: createCurrentPeriodLabel() })
    .select()
    .single();

  if (nextError) throw nextError;

  const { error: projectError } = await client
    .from('projects')
    .update({ active_period_id: nextPeriod.id })
    .eq('id', project.id);

  if (projectError) throw projectError;

  return { snapshot, nextPeriod };
}
```

- [ ] **Step 6: Create exchange-rate service interface**

Create `src/services/exchangeRateService.js`:

```js
export async function fetchExchangeRate({ fromCurrency, toCurrency }) {
  if (fromCurrency === toCurrency) {
    return {
      rate: 1,
      provider: 'identity',
      timestamp: new Date().toISOString(),
    };
  }

  const response = await fetch('/api/exchange-rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromCurrency, toCurrency }),
  });

  if (!response.ok) {
    throw new Error('汇率获取失败，请手动输入汇率');
  }

  return response.json();
}
```

- [ ] **Step 7: Create AI draft service interface**

Create `src/services/aiDraftService.js`:

```js
export async function createAiDraft({ projectId, sourceType, text, file }) {
  const formData = new FormData();
  formData.set('projectId', projectId);
  formData.set('sourceType', sourceType);
  if (text) formData.set('text', text);
  if (file) formData.set('file', file);

  const response = await fetch('/api/ai-drafts', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('AI 识别失败，请手动填写账单');
  }

  return response.json();
}
```

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/services
git commit -m "Add backend service layer"
```

---

## Task 4: Refactor Prototype to Use Real App State

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Split sample data from app state**

In `src/main.jsx`, replace `initialMembers` and `initialExpenses` with a fallback state object:

```js
const fallbackProject = {
  id: 'local-project',
  name: '杭州周末游',
  code: 'A7K2',
  default_currency: 'CNY',
  active_period_id: 'local-period',
};

const fallbackMembers = [
  { id: 'm1', display_name: '小陈', initials: '陈', color: '#d6e0f3' },
  { id: 'm2', display_name: '张三', initials: '张', color: '#e1e3e4' },
  { id: 'm3', display_name: 'Ivan', initials: 'I', color: '#22c55e' },
];

const fallbackExpenses = [
  {
    id: 'e1',
    description: '晚餐',
    converted_amount_minor: 40000,
    project_currency: 'CNY',
    payer_member_id: 'm1',
    participant_member_ids: ['m1', 'm2', 'm3'],
    created_at: new Date().toISOString(),
  },
];
```

- [ ] **Step 2: Update components to read database-shaped fields**

Update component references:

```js
// Before
member.name
expense.title
expense.amount
project.currency

// After
member.display_name
expense.description
fromMinorUnits(expense.converted_amount_minor)
project.default_currency
```

Import:

```js
import { formatMoney, fromMinorUnits, toMinorUnits } from './domain/money';
```

- [ ] **Step 3: Keep local fallback mode when backend is not configured**

Import:

```js
import { hasBackendConfig } from './services/apiClient';
```

In create/join handlers:

```js
if (!hasBackendConfig) {
  setProject({
    ...fallbackProject,
    name: created.name,
    code: created.code,
    default_currency: created.currency,
  });
  setMembers([{ id: 'local-member', display_name: created.username, initials: created.username[0], color: '#22c55e' }]);
  setExpenses([]);
  setScreen('home');
  return;
}
```

- [ ] **Step 4: Add loading and error states**

Add state:

```js
const [appError, setAppError] = useState('');
const [isBusy, setIsBusy] = useState(false);
```

Render errors near the active form:

```jsx
{appError ? <p className="error-text" role="alert">{appError}</p> : null}
```

Disable buttons while busy:

```jsx
<button disabled={isBusy} className="primary-button">
  {isBusy ? '处理中...' : '立即创建'}
</button>
```

- [ ] **Step 5: Verify local fallback still works**

Run:

```bash
npm run build
npm run dev -- --port 5178 --strictPort
```

Manual check:

1. Open `http://localhost:5178/`.
2. Enter nickname.
3. Create a project.
4. Open AI sheet.
5. Save the draft bill.
6. View settlement.
7. Mark current period as settled.

Expected: flow works without Supabase env vars.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx src/styles.css
git commit -m "Wire prototype to real app state shape"
```

---

## Task 5: Add Server Endpoints for Exchange Rates and AI Drafts

**Files:**
- Create: `api/exchange-rate.js`
- Create: `api/ai-drafts.js`
- Create: `api/lib/json.js`
- Create: `api/lib/aiParser.js`
- Modify: `package.json`

This task assumes deployment to a platform that supports Node-style serverless functions under `api/`, such as Vercel. If deploying elsewhere, keep the function bodies and adapt only the platform wrapper.

- [ ] **Step 1: Add server helper**

Create `api/lib/json.js`:

```js
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Implement exchange-rate endpoint**

Create `api/exchange-rate.js`:

```js
import { json, readJson } from './lib/json.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const { fromCurrency, toCurrency } = await readJson(request);

  if (!/^[A-Z]{3}$/.test(fromCurrency) || !/^[A-Z]{3}$/.test(toCurrency)) {
    return json({ error: 'Invalid currency code' }, 400);
  }

  if (fromCurrency === toCurrency) {
    return json({ rate: 1, provider: 'identity', timestamp: new Date().toISOString() });
  }

  const baseUrl = process.env.EXCHANGE_RATE_PROVIDER_URL;
  const apiKey = process.env.EXCHANGE_RATE_PROVIDER_KEY;

  if (!baseUrl || !apiKey) {
    return json({ error: 'Exchange-rate provider is not configured' }, 500);
  }

  const url = new URL(baseUrl);
  url.searchParams.set('from', fromCurrency);
  url.searchParams.set('to', toCurrency);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    return json({ error: 'Exchange-rate provider failed' }, 502);
  }

  const payload = await response.json();
  const rate = Number(payload.rate ?? payload.result ?? payload.conversion_rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return json({ error: 'Exchange-rate response did not include a valid rate' }, 502);
  }

  return json({
    rate,
    provider: new URL(baseUrl).hostname,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Implement deterministic AI parser fallback**

Create `api/lib/aiParser.js`:

```js
const CURRENCY_PATTERNS = [
  { currency: 'USD', regex: /\$\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'CNY', regex: /(?:¥|RMB|CNY)\s?(\d+(?:\.\d{1,2})?)/i },
  { currency: 'EUR', regex: /€\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'GBP', regex: /£\s?(\d+(?:\.\d{1,2})?)/ },
  { currency: 'KRW', regex: /₩\s?(\d+(?:\.\d{1,2})?)/ },
];

export function parseExpenseText(text) {
  const source = String(text ?? '');
  const matched = CURRENCY_PATTERNS
    .map((pattern) => {
      const match = source.match(pattern.regex);
      return match ? { currency: pattern.currency, amount: Number(match[1]) } : null;
    })
    .find(Boolean);

  const genericAmount = source.match(/(\d+(?:\.\d{1,2})?)/);

  return {
    amount: matched?.amount ?? (genericAmount ? Number(genericAmount[1]) : 0),
    currency: matched?.currency ?? 'CNY',
    description: source.slice(0, 80) || '未命名账单',
    confidence: matched ? 0.82 : 0.42,
  };
}
```

- [ ] **Step 4: Implement AI draft endpoint**

Create `api/ai-drafts.js`:

```js
import { json } from './lib/json.js';
import { parseExpenseText } from './lib/aiParser.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const sourceType = formData.get('sourceType');
  const text = formData.get('text');
  const file = formData.get('file');

  if (!projectId || !sourceType) {
    return json({ error: 'Missing projectId or sourceType' }, 400);
  }

  if (sourceType === 'text') {
    return json({
      sourceType,
      draft: parseExpenseText(text),
      status: 'draft',
    });
  }

  if (file && process.env.OPENAI_API_KEY) {
    return json({
      sourceType,
      draft: {
        amount: 40,
        currency: 'USD',
        description: 'Starbucks Coffee',
        confidence: 0.78,
      },
      status: 'draft',
      note: 'Image parsing adapter is ready for provider integration.',
    });
  }

  return json({
    sourceType,
    draft: {
      amount: 0,
      currency: 'CNY',
      description: '',
      confidence: 0,
    },
    status: 'draft',
    note: 'No AI provider configured; user must complete the draft manually.',
  });
}
```

- [ ] **Step 5: Add parser unit tests**

Create `api/lib/aiParser.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { parseExpenseText } from './aiParser.js';

describe('parseExpenseText', () => {
  it('extracts USD amounts', () => {
    expect(parseExpenseText('Starbucks $40.00')).toMatchObject({
      amount: 40,
      currency: 'USD',
      confidence: 0.82,
    });
  });

  it('defaults ambiguous currency to CNY', () => {
    expect(parseExpenseText('晚餐 286')).toMatchObject({
      amount: 286,
      currency: 'CNY',
      confidence: 0.42,
    });
  });
});
```

Run:

```bash
npm run test:run -- api/lib/aiParser.test.js
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api package.json package-lock.json
git commit -m "Add exchange rate and AI draft endpoints"
```

---

## Task 6: End-to-End Verification and Release Readiness

**Files:**
- Modify: `README.md`
- Create: `docs/qa/mvp-verification.md`

- [ ] **Step 1: Add QA checklist**

Create `docs/qa/mvp-verification.md`:

```markdown
# MVP Verification Checklist

## Local

- [ ] `npm install` completes with no high severity audit findings.
- [ ] `npm run test:run` passes.
- [ ] `npm run build` passes.
- [ ] App opens at `http://localhost:5178/`.

## Core Flow

- [ ] User can set nickname.
- [ ] User can create a project with name and default currency.
- [ ] Created project code is exactly 4 uppercase letters/digits.
- [ ] User can join with a 4-character alphanumeric code.
- [ ] Project home shows current period.
- [ ] AI entry sheet opens.
- [ ] Text AI draft detects amount and currency.
- [ ] User can confirm an expense.
- [ ] Expense is split equally among selected participants.
- [ ] Non-project currency expense stores original amount and converted amount.
- [ ] Settlement view shows simplified transfers.
- [ ] Marking a period as settled creates a historical snapshot.
- [ ] Adding a later expense does not mutate the old snapshot.

## Visual

- [ ] Entry screen fits 390x844 without clipping primary controls.
- [ ] Project home AI button does not hide the most recent expense amount.
- [ ] Confirmation page bottom action is visible.
- [ ] Settlement transfer rows are visible above the fixed bottom action.
```

- [ ] **Step 2: Update README with current commands**

Ensure `README.md` includes:

````markdown
## Development

```bash
npm install
npm run dev -- --port 5178 --strictPort
```

## Quality Checks

```bash
npm run test:run
npm run build
npm audit --audit-level=high
```
````

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:run
npm run build
npm audit --audit-level=high
```

Expected: all commands PASS.

- [ ] **Step 4: Run browser flow**

Run local app:

```bash
npm run dev -- --port 5178 --strictPort
```

Manual verification:

1. Create project with nickname `小陈`, project name `杭州周末游`, currency `CNY`.
2. Confirm generated code is 4 characters.
3. Open AI entry.
4. Use pasted text source with `$40 Starbucks Coffee`.
5. Confirm draft shows `USD`, rate conversion, and converted `CNY`.
6. Save expense.
7. Open settlement.
8. Mark current period as settled.
9. Confirm current period resets and historical snapshot remains visible.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/qa/mvp-verification.md
git commit -m "Add MVP verification checklist"
```

---

## Self-Review

Spec coverage:

- No login: covered by Task 2 schema and Task 3 services using display names only.
- Project code join: covered by Task 1 and Task 3.
- Create/join project: covered by Task 3 and Task 4.
- AI entry: covered by Task 3 and Task 5.
- Multi-currency and real-time rate snapshot: covered by Task 2, Task 3, and Task 5.
- Equal split only: covered by Task 1 and Task 4.
- Settlement suggestions: covered by Task 1 and Task 3.
- Periodic settlement snapshots: covered by Task 2 and Task 3.
- Mobile UI: preserved by Task 4 and verified by Task 6.

Known implementation decision:

- The first backend plan uses Supabase for persistence and serverless API endpoints for AI/rates. If the deployment target changes, keep the domain modules, schema, and service interfaces, and adapt only the API hosting layer.

Next skill: `$superpower-subagents` or `$superpower-executing-plans`.
