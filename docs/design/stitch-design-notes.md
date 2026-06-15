# Stitch Design Notes

## Source

- Original Stitch export: [stitch-export.html](stitch-export.html)

## Included Screens

The Stitch export contains these mobile app surfaces:

- Entry screen for setting a nickname, creating a project, or joining by project code.
- Create project screen with project name and settlement currency.
- Project home screen with project code, members, totals, recent expenses, and AI entry.
- AI input bottom sheet with photo, screenshot, and pasted text options.
- Draft confirmation screen with multi-currency conversion and exchange-rate refresh.
- Settlement summary screen with current period, balances, transfers, history, and mark-as-settled action.

## Design System To Reuse

- Primary color: green, centered around `#22c55e` / `#006e2f`.
- Background: cool light gray `#f8f9fa`.
- Surfaces: white and near-white cards with subtle borders.
- Typography: Plus Jakarta Sans for headings and price display, Inter/PingFang SC for body text.
- Radius: mostly `12px` cards and controls.
- Layout: mobile-first app shell with fixed top app bar and bottom navigation on project screens.
- Interaction pattern: large touch targets, active scale feedback, bottom-sheet AI entry.

## Required Corrections Before Implementation

These issues should be corrected in the final design or implementation:

- Project code must be exactly 4 characters, but one Stitch screen shows `#X8K2P`, which is 5 characters. Use examples like `A7K2` or `X8K2`.
- Join-project input script currently restricts project codes to digits only. It must allow uppercase letters and digits.
- Entry screen includes terms/privacy copy. This is optional; keep it only if the product will actually provide those pages.
- Some screens use remote Google image URLs for avatars and decorative photos. Implementation should replace them with local/generated assets, initials, or app-native placeholders.
- Comments in the export label some screens inconsistently. Treat the visual structure, not the comment labels, as the source of truth.
- The create-project helper says "唯一的4位邀请码"; keep wording aligned with "项目码" unless the product intentionally uses "邀请码".

## Implementation Guidance

When building from this design, implement these screens as real app states rather than separate static pages:

1. Entry.
2. Create project.
3. Project home.
4. AI input sheet.
5. Draft confirmation.
6. Settlement summary.

The first implementation should remain a lightweight tool:

- No login.
- Anyone with the 4-character code can join.
- Equal split only.
- Multi-currency expense capture with exchange-rate snapshot.
- Periodic settlement with historical snapshots.
- No payment integration.
