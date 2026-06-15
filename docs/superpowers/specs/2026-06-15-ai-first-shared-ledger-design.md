# AI-first Shared Ledger Product Design

## Summary

This project is a lightweight shared expense ledger for Chinese-speaking users. It helps friends, roommates, couples, and small groups record shared costs, calculate balances, and settle up with less awkwardness.

The product direction is AI-first: users should be able to upload WeChat Pay screenshots, Alipay screenshots, receipt photos, or pasted chat text, and the system should turn them into draft expense records. AI output is never final by default. The user reviews, corrects, and confirms each draft before it affects ledger balances.

The first version should prioritize a complete shared-expense loop over deep scenario-specific workflows. Travel, co-living, meals, and events are supported as ledger templates using the same underlying model.

## Target Users

- A group organizer who usually pays first and tracks shared costs for a trip, meal, party, or shared house.
- Roommates who need to split rent, utilities, internet, daily supplies, and recurring household expenses.
- Friends traveling together who need to record hotels, transportation, meals, tickets, and ad hoc purchases.
- Chinese-speaking users who already coordinate money through WeChat groups, WeChat Pay, and Alipay.

## Positioning

The product is not a full personal finance app. It is a shared ledger for informal group debts.

The product should optimize for:

- Fast entry from real payment artifacts: screenshots, receipts, and pasted text.
- Low-friction sharing: people can view balances without creating an account.
- Clear settlement: each person can see what they owe or should receive.
- Chinese payment context: WeChat Pay and Alipay screenshots are first-class input sources.

The product should avoid in the first version:

- Direct payment processing.
- Bank account linking.
- Full personal budget management.
- Complex accounting reports.
- Deep trip itinerary planning or full property-management features.

## MVP Scope

### 1. Ledgers

A ledger represents one shared expense context, such as:

- A trip.
- A shared apartment.
- A meal or party.
- A custom group activity.

Each ledger has:

- Name.
- Type template: travel, co-living, meal, event, or custom.
- Default settlement currency, defaulting to CNY.
- Members.
- Expenses.
- Active settlement period.
- Settlement state.
- Share links.

Templates should only prefill labels and suggested categories in the MVP. They should not create separate product architectures.

### 2. Members

The ledger owner can add members by nickname. Members do not need accounts for the first version.

Each member has:

- Display name.
- Optional note or alias.
- Optional share token for viewing their own balance.

The MVP should support:

- Owner editing all expenses.
- Shared read-only ledger view.
- Member-specific balance view through a private link.

The MVP should not require every participant to sign up before the ledger is useful.

### 3. AI Input

AI input is the central differentiator.

Supported inputs for MVP:

- Image upload: WeChat Pay screenshot.
- Image upload: Alipay screenshot.
- Image upload: paper receipt photo.
- Text paste: chat messages or manually copied payment text.

The AI parser should produce one or more draft expenses with:

- Amount.
- Currency.
- Converted amount in the ledger currency when needed.
- Exchange rate snapshot when the source currency differs from the ledger currency.
- Merchant or description.
- Paid-by candidate.
- Expense date and time if available.
- Source type.
- Confidence score per important field.
- Suggested category.
- Suggested participants.
- Suggested split mode.

Every AI result goes to a confirmation screen before it is saved.

If confidence is low, the UI should clearly require user correction. Low confidence should not block manual completion.

### 4. Manual Expense Entry

Manual entry is required as the reliability fallback.

Fields:

- Description.
- Amount.
- Currency.
- Exchange rate when currency conversion is used.
- Paid by.
- Participants.
- Split mode.
- Date.
- Category.
- Notes.

Supported split modes for MVP:

- Equal split among selected participants.
- Exact amount per participant.
- Percentage split.
- Share-based split.

Manual entry and AI-confirmed entry should create the same expense records.

### 5. Balances and Settlement

The product calculates:

- Total paid by each member.
- Total owed by each member.
- Net balance.
- Simplified settlement suggestions.

Settlement suggestions should minimize the number of payments where practical. For example, instead of preserving every original debt edge, the app should calculate a smaller set of transfers from debtors to creditors.

The MVP supports:

- Owner marking a suggested transfer as settled.
- Recording settlement method as text: WeChat, Alipay, cash, bank transfer, or other.
- Showing remaining unsettled balances.
- Ongoing ledgers where expenses can continue after a period is settled.
- Historical settlement snapshots for previous periods.

The MVP does not initiate payments.

### 6. Periodic Settlement

Some ledgers are ongoing and need periodic settlement.

Examples:

- Roommates settling monthly household costs.
- Friends settling a long trip every few days.
- A repeated group activity settling after each event.

The MVP should support:

- One active settlement period per ledger.
- New expenses added to the active period by default.
- Settlement calculations scoped to the active period.
- Marking the active period as settled.
- Saving a settlement snapshot when a period is settled.
- Starting a new active period after settlement.
- Viewing previous settled periods.

Historical settlement snapshots should not change when new expenses are added later.

## Core User Flow

### Create Ledger

1. User creates a ledger.
2. User chooses a template: travel, co-living, meal, event, or custom.
3. User adds member nicknames.
4. User lands on the ledger detail page.

### AI Add Expense

1. User opens AI input.
2. User uploads an image or pastes text.
3. System parses the input into draft expenses.
4. User reviews detected fields.
5. User corrects amount, paid-by, participants, split mode, date, or category as needed.
6. User confirms.
7. Expense is saved and balances update.

### Manual Add Expense

1. User opens add expense.
2. User enters fields manually.
3. User saves.
4. Balances update.

### Share and Settle

1. Owner shares a ledger link or member-specific balance link.
2. Participants view balances without registering.
3. At the end of the activity or month, owner opens settlement.
4. App shows simplified transfer suggestions.
5. Owner marks the current period as settled.
6. App saves a settlement snapshot and starts a new active period for future expenses.

## Data Model

### Ledger

- `id`
- `name`
- `template`
- `default_currency`
- `active_period_id`
- `owner_id`
- `created_at`
- `updated_at`

### Member

- `id`
- `ledger_id`
- `display_name`
- `alias`
- `created_at`

### Expense

- `id`
- `ledger_id`
- `period_id`
- `description`
- `original_amount`
- `original_currency`
- `converted_amount`
- `ledger_currency`
- `exchange_rate`
- `exchange_rate_provider`
- `exchange_rate_timestamp`
- `paid_by_member_id`
- `expense_date`
- `category`
- `source_type`
- `source_id`
- `notes`
- `created_at`
- `updated_at`

### Expense Split

- `id`
- `expense_id`
- `member_id`
- `split_mode`
- `owed_amount`
- `percentage`
- `shares`

### AI Source

- `id`
- `ledger_id`
- `input_type`
- `original_file_ref`
- `original_text`
- `parser_version`
- `status`
- `created_at`

### AI Draft Expense

- `id`
- `ai_source_id`
- `draft_payload`
- `field_confidence`
- `status`
- `created_at`
- `confirmed_expense_id`

### Settlement Transfer

- `id`
- `ledger_id`
- `from_member_id`
- `to_member_id`
- `amount`
- `ledger_currency`
- `status`
- `method`
- `settled_at`

### Settlement Period

- `id`
- `ledger_id`
- `label`
- `status`
- `started_at`
- `ended_at`
- `settled_at`

### Settlement Snapshot

- `id`
- `ledger_id`
- `period_id`
- `ledger_currency`
- `included_expense_ids`
- `member_balance_payload`
- `transfer_payload`
- `created_at`

## AI Parsing Principles

AI parsing should be treated as extraction plus suggestion, not authority.

Rules:

- Preserve the original source reference when possible so users can verify the draft.
- Keep confidence visible at the field level for internal logic.
- Require confirmation before writing an expense.
- Allow users to edit every extracted field.
- Store parser version for future debugging and quality evaluation.
- Do not infer sensitive personal identity beyond ledger member nicknames.

Initial parsing targets:

- Payment screenshots: amount, currency, merchant, time, payment platform.
- Receipts: total amount, currency, merchant, time, line items when clear.
- Chat text: payer, amount, currency, description, participant hints.

For non-ledger currencies, the app should fetch a real-time exchange rate before confirmation, store the rate as a snapshot, and use the converted ledger-currency amount for balances and settlement. Old expenses should not be silently revalued when exchange rates change later.

Line-item splitting can be explored later. MVP receipt parsing can start with total-level expense extraction.

## Privacy and Safety

The product handles sensitive financial artifacts. The MVP should apply these product constraints:

- Do not expose uploaded source images through public links.
- Share links should reveal only ledger data needed for viewing balances.
- Member-specific links should avoid showing unrelated private details when possible.
- Original AI source files should be deletable by the ledger owner.
- Avoid storing unnecessary payment account identifiers from screenshots.
- Clearly communicate that ledger records are informal and not legally binding.

## UX Principles

- Mobile-first.
- One-handed quick entry.
- Confirmation before AI data enters the ledger.
- Clear difference between draft, confirmed, and settled states.
- No forced signup for passive participants.
- Chinese-first labels and payment method assumptions.
- Every AI flow must have a manual correction path.

## Non-Goals for MVP

- Native mobile app.
- Direct WeChat Pay, Alipay, Venmo, PayPal, or bank transfer integration.
- Multi-owner permission system.
- Legal debt enforcement.
- Advanced analytics.
- Full receipt itemization.
- Real-time collaborative editing.
- Offline mode.

## Success Criteria

The MVP is successful if one organizer can:

- Create a shared ledger in under one minute.
- Add participants without requiring signups.
- Upload or paste at least one payment artifact and turn it into a confirmed expense.
- Detect or manually set the expense currency.
- Convert non-ledger-currency expenses with a real-time exchange rate snapshot.
- Manually correct AI mistakes before saving.
- Record multiple shared expenses.
- Share a read-only balance view.
- See simplified settlement suggestions.
- Mark a settlement period as settled.
- Continue adding expenses after settlement without changing historical settlement records.

## Later Roadmap

Potential second-phase features:

- Better receipt itemization and per-person dish/item assignment.
- Recurring bills for co-living: rent, utilities, internet, cleaning, supplies.
- Travel budget planning: estimated budget vs actual spending.
- WeChat group-friendly share cards.
- Payment screenshot matching for settlement verification.
- Historical FX charts and automatic revaluation of old expenses.
- Member accounts for people who want cross-ledger history.
- Member-side settlement confirmation.
- Automatic recurring bill reminders.
- Notifications and reminders.
- Export to CSV or spreadsheet.
