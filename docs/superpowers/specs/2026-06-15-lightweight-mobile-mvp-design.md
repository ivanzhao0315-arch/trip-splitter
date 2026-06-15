# Lightweight Mobile MVP Design

## Summary

This version is a lightweight mobile-first shared expense tool. It focuses on fast project entry, simple group joining through a short project code, AI-assisted expense entry, equal splitting, and clear settlement.

The first version should feel like a small utility, not a full finance app. Users should be able to open the app, set a display name, create or join a project, record expenses from photos/screenshots/text, and see who owes whom.

## Product Principles

- No login required for MVP.
- No approval flow for joining a project.
- Anyone with the project code can enter the project.
- Usernames are display names only.
- Equal split is the only split mode in MVP.
- Expenses can be entered in different currencies.
- Settlement is shown in the project's default currency.
- Projects can accumulate expenses over time and settle by period.
- AI helps create draft expenses, but the user confirms before saving.
- Keep the app mobile-first and fast.

## First Screen

The first screen is the entry screen.

Required elements:

- App name.
- Username input.
- Create project button.
- Join project input and button.

The user must set a username before creating or joining a project.

Example username values:

- `小陈`
- `张三`
- `Ivan`

## Project Creation

When creating a project, the user enters:

- Project name.
- Default settlement currency.

Examples:

- `杭州周末游`
- `6月合租账单`
- `周末聚餐`

After creation, the app generates a 4-character project code.

Project code rules:

- Exactly 4 characters.
- Characters are uppercase letters and digits.
- Examples: `A7K2`, `M3Q9`, `8F2B`.
- Codes should be easy to read and enter.

The project creator immediately enters the project after creation.

The default settlement currency is used for totals, balances, and settlement suggestions. For Chinese users, the default should be `CNY`, but travel projects should allow selecting another settlement currency such as `USD`, `JPY`, `EUR`, `GBP`, `HKD`, `TWD`, `SGD`, or `KRW`.

## Project Joining

To join a project, a user enters:

- Username.
- 4-character project code.

Anyone who knows the project code can enter.

MVP does not include:

- Owner approval.
- Invite links.
- Phone verification.
- Passwords.
- Member permissions.

If the project code does not exist, show a simple error and let the user try again.

## Project Home

The project home is the main working screen.

Required elements:

- Project name.
- Project code.
- Member list.
- Total spending.
- My balance.
- Recent expenses.
- Primary AI entry button.
- Settlement summary.
- Current settlement period.

The project code should be easy to copy or show to others.

Projects are ongoing by default. Users can keep adding payment records after a settlement. A settlement should not close the project.

## AI Expense Entry

The project home has one main action: AI entry.

MVP input methods:

- Take a photo.
- Upload/select a screenshot.
- Paste text.

Supported source examples:

- Paper receipt photo.
- WeChat Pay screenshot.
- Alipay screenshot.
- Group chat text.

The AI parser creates a draft expense.

Draft fields:

- Amount.
- Currency.
- Payer.
- Participants.
- Description.
- Date/time if detected.
- Exchange rate if the detected currency differs from the project currency.
- Converted amount in the project currency.

The user must confirm the draft before it is saved.

## Manual Correction

The confirmation screen must allow editing:

- Amount.
- Currency.
- Payer.
- Participants.
- Description.
- Exchange rate when currency conversion is used.

If AI detection fails, the user should still be able to manually complete the expense from the same confirmation screen.

## Currency and Exchange Rates

The app must support expenses in different currencies.

Currency behavior:

- Each project has one default settlement currency.
- Each expense stores the original amount and original currency.
- If an expense currency differs from the project currency, the app converts it using a real-time exchange rate.
- The converted project-currency amount is used for equal split and settlement.
- The expense detail should still show the original amount and currency for transparency.

AI currency detection:

- AI should detect currency symbols and codes from screenshots, receipts, and pasted text.
- Examples: `¥`, `CNY`, `RMB`, `$`, `USD`, `HK$`, `JPY`, `円`, `€`, `EUR`, `£`, `GBP`, `₩`, `KRW`.
- If the currency is ambiguous, default to the project currency and ask the user to confirm.

Exchange rate requirements:

- Fetch a real-time exchange rate when the user confirms an expense in a non-project currency.
- Store the exchange rate used at confirmation time as a snapshot.
- Store the rate timestamp and provider name.
- Do not silently recalculate old expenses when rates change later.
- Allow the user to refresh the exchange rate before confirming.
- Allow manual rate override if the user wants to use a card statement rate or cash exchange rate.

Example:

- Project currency: `CNY`
- Expense: `$40.00 USD`
- Rate snapshot: `1 USD = 7.25 CNY`
- Converted amount: `¥290.00 CNY`
- Equal split and settlement use `¥290.00`.

## Split Rule

MVP supports only equal split.

For each expense:

- User selects participants.
- App divides the amount equally among selected participants.
- Payer can be one of the participants.

MVP does not support:

- Percentage split.
- Exact amount split.
- Share-based split.
- Per-item receipt splitting.
- Multiple payers for one expense.

## Settlement Rule

The app calculates:

- How much each member paid.
- How much each member should pay.
- Each member's net balance.
- Simplified transfers from people who owe money to people who should receive money.
- All settlement totals in the project default currency.

Example:

- `小陈 -> 我 ¥96.00`
- `小李 -> 我 ¥74.00`

The MVP can show transfer suggestions only. It does not initiate payment.

## Periodic Settlement

The app must support accumulating payment information over time because some projects are settled periodically.

Examples:

- Roommates settle rent, utilities, and daily supplies every month.
- Friends on a long trip settle every few days.
- A recurring group activity settles after each event.

MVP behavior:

- A project has one active settlement period.
- New expenses are added to the active period by default.
- The settlement view calculates balances for the active period.
- When users finish a settlement, the app can mark the active period as settled.
- Marking a period as settled creates a settlement snapshot.
- After settlement, the project remains open and a new active period starts.
- Historical settled periods remain viewable.

Settlement snapshot requirements:

- Store the period start and end time.
- Store the expenses included in the period.
- Store member balances at settlement time.
- Store suggested transfers at settlement time.
- Store the project currency used for the settlement.
- Do not change a historical settlement snapshot when later expenses are added.

The MVP should provide simple labels for periods:

- `当前周期`
- `2026-06`
- `第 1 次结算`
- Custom name entered by the user if needed.

The MVP does not need automatic calendar billing rules. Users can manually mark a period as settled and start the next one.

## Data Model

### Project

- `id`
- `name`
- `code`
- `default_currency`
- `active_period_id`
- `created_at`

### Member

- `id`
- `project_id`
- `display_name`
- `joined_at`

### Expense

- `id`
- `project_id`
- `period_id`
- `original_amount`
- `original_currency`
- `converted_amount`
- `project_currency`
- `exchange_rate`
- `exchange_rate_provider`
- `exchange_rate_timestamp`
- `description`
- `payer_member_id`
- `participant_member_ids`
- `source_type`
- `created_at`

### Settlement Period

- `id`
- `project_id`
- `label`
- `status`
- `started_at`
- `ended_at`
- `settled_at`

### Settlement Snapshot

- `id`
- `project_id`
- `period_id`
- `project_currency`
- `included_expense_ids`
- `member_balance_payload`
- `transfer_payload`
- `created_at`

### AI Draft

- `id`
- `project_id`
- `source_type`
- `source_ref`
- `draft_payload`
- `status`
- `created_at`

## Mobile Screen Set

The MVP needs these mobile screens:

1. Entry screen: set username, create project, join project.
2. Create project screen or modal.
3. Project home.
4. AI input options.
5. Draft confirmation.
6. Settlement view.

## Google Stitch Prompt

Use this prompt if designing the app in Google Stitch:

```text
Design a lightweight mobile app for shared expense splitting in Chinese.

The app is a simple utility, not a full finance platform. First screen lets the user set a display name, create a project, or join a project with a 4-character code. No login. Anyone with the code can enter.

Core flow:
1. User enters display name.
2. User creates a project by entering a project name, or joins with a 4-character code like A7K2.
3. Project home shows project name, project code, members, total spending, my balance, recent expenses, and a primary AI entry button.
4. AI entry supports taking a photo, uploading a screenshot, or pasting text.
5. AI creates a draft expense with amount, payer, participants, description, and date/time if detected.
6. AI detects the payment currency. If it differs from the project currency, the app fetches a real-time exchange rate and shows the converted amount.
7. User confirms or corrects the draft, including currency and exchange rate if needed.
8. App splits the converted project-currency amount equally among selected participants.
9. Settlement view shows simplified transfers for the current settlement period in the project currency, such as 小陈 -> 我 ¥96.00.
10. User can mark the current period as settled, save a settlement snapshot, and continue adding future expenses to a new period.

Design style:
Mobile-first iPhone app, Chinese interface, clean and practical, true white and cool light gray background, one green accent, readable sans-serif typography, large touch targets, no dark mode, no purple AI glow, no marketing hero, no complex dashboard.
```

## Non-Goals

- Login or account system.
- Owner approval for joining.
- Payment integration.
- Budget planning.
- Travel itinerary planning.
- Automatic recurring bill reminders.
- Complex split modes.
- Historical FX charting.
- Automatic revaluation of old expenses when exchange rates change.
- Desktop dashboard.
- Long-term analytics.

## MVP Success Criteria

The MVP is successful if a small group can:

- Open the app without signup.
- Set display names.
- Create a project and share a 4-character code.
- Join a project using the code.
- Add an expense through photo, screenshot, or pasted text.
- Correctly detect or manually set the expense currency.
- Convert non-project-currency expenses using a real-time exchange rate snapshot.
- Confirm the AI-generated draft.
- Split the expense equally.
- See who owes whom in the project default currency.
- Mark a settlement period as settled.
- Continue adding new expenses after settlement without changing historical settlement records.
