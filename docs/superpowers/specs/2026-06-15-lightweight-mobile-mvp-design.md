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

The project code should be easy to copy or show to others.

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
- Payer.
- Participants.
- Description.
- Date/time if detected.

The user must confirm the draft before it is saved.

## Manual Correction

The confirmation screen must allow editing:

- Amount.
- Payer.
- Participants.
- Description.

If AI detection fails, the user should still be able to manually complete the expense from the same confirmation screen.

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

Example:

- `小陈 -> 我 ¥96.00`
- `小李 -> 我 ¥74.00`

The MVP can show transfer suggestions only. It does not initiate payment.

## Data Model

### Project

- `id`
- `name`
- `code`
- `created_at`

### Member

- `id`
- `project_id`
- `display_name`
- `joined_at`

### Expense

- `id`
- `project_id`
- `amount`
- `description`
- `payer_member_id`
- `participant_member_ids`
- `source_type`
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
6. User confirms or corrects the draft.
7. App splits the expense equally among selected participants.
8. Settlement view shows simplified transfers, such as 小陈 -> 我 ¥96.00.

Design style:
Mobile-first iPhone app, Chinese interface, clean and practical, true white and cool light gray background, one green accent, readable sans-serif typography, large touch targets, no dark mode, no purple AI glow, no marketing hero, no complex dashboard.
```

## Non-Goals

- Login or account system.
- Owner approval for joining.
- Payment integration.
- Budget planning.
- Travel itinerary planning.
- Roommate recurring bill reminders.
- Complex split modes.
- Desktop dashboard.
- Long-term analytics.

## MVP Success Criteria

The MVP is successful if a small group can:

- Open the app without signup.
- Set display names.
- Create a project and share a 4-character code.
- Join a project using the code.
- Add an expense through photo, screenshot, or pasted text.
- Confirm the AI-generated draft.
- Split the expense equally.
- See who owes whom.
