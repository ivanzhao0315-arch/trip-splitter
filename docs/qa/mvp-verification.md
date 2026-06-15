# MVP Verification Checklist

## Local

- [ ] `npm install` completes with no high severity audit findings.
- [ ] `npm run test:run` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] App opens at `http://localhost:5178/` or the fallback port selected by Vite.

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
- [ ] Settlement transfer rows or empty state are visible above the fixed bottom action.
- [ ] Settlement success toast does not cover active content.
