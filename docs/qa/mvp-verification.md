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
- [ ] User can choose trip or roommate project type when creating a project.
- [ ] Optional project budget is shown as remaining budget after expenses are added.
- [ ] Created project code is exactly 4 uppercase letters/digits.
- [ ] Project code can be copied from the top bar for sharing in WeChat.
- [ ] User can join with a 4-character alphanumeric code.
- [ ] In local/dev mode, joining with an existing project code loads the same stored project state.
- [ ] Joining the same backend project with the same nickname reuses that member instead of creating duplicates.
- [ ] Project home shows current period.
- [ ] AI entry sheet opens.
- [ ] Text AI draft detects amount and currency.
- [ ] Text AI draft uses the server AI endpoint to infer payer and participants when `OPENAI_API_KEY` is configured.
- [ ] AI draft preselects payer and participants when names can be inferred from the source.
- [ ] Photo and screenshot AI draft paths send the uploaded image to the server AI endpoint when `OPENAI_API_KEY` is configured.
- [ ] Photo and screenshot local fallback opens an empty manual draft instead of fake recognized data.
- [ ] Photo and screenshot expenses persist and display their source file name when available.
- [ ] User can confirm an expense.
- [ ] Expense is split equally among selected participants.
- [ ] Expense save rejects payer or participant ids that do not belong to the current project.
- [ ] Non-project currency expense stores original amount and converted amount.
- [ ] Recent detail rows show original amount/currency and exchange-rate source for non-project currency expenses.
- [ ] Non-project currency expense tries the server exchange-rate provider before using local fallback rates.
- [ ] Exchange-rate endpoint accepts pair and table-style provider responses and rejects missing rates.
- [ ] Settlement view shows simplified transfers.
- [ ] Settlement view can copy a Chinese transfer message suitable for WeChat group chat.
- [ ] Marking a period as settled creates a historical snapshot.
- [ ] Historical settlement snapshots persist and display the settled period label after reload.
- [ ] Settling multiple times in the same month creates distinguishable period labels such as `2026-06 #2`.
- [ ] Adding a later expense does not mutate the old snapshot.

## Visual

- [ ] Entry screen fits 390x844 without clipping primary controls.
- [ ] Project home AI button does not hide the most recent expense amount.
- [ ] Confirmation page bottom action is visible.
- [ ] Settlement transfer rows or empty state are visible above the fixed bottom action.
- [ ] Settlement success toast does not cover active content.
