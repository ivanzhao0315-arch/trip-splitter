# Creator Member Management

The project creator can remove members under Settings. Removal sets `members.removed_at`; bills, historical payer/participant IDs, and outstanding balances remain unchanged. Removed members are excluded from the active roster and new bill selection. The creator cannot remove themselves.

The app has no account login. New projects receive a random 256-bit creator credential stored on the creating browser; the database stores only its SHA-256 hash in a private RLS-protected table. Matching a nickname does not grant management rights. Older projects require explicit owner verification and administrator provisioning; they are never claimed by the first visitor.

An administrator-provided management link imports the credential from the URL fragment after server verification and removes the fragment from the address bar. Keep that link private. Clearing browser storage or moving devices requires the original management credential. Invite links strip the fragment.

Apply `supabase/migrations/0012_creator_member_management.sql` before deploying this frontend. Use the target project's existing migration process; verify its project reference before any database command. To verify database permissions without retaining test fixtures, run `BEGIN;` followed by `supabase/tests/creator_member_management.sql` (which ends in `ROLLBACK;`).

Direct anonymous member deletion, archival updates, and project deletion are revoked. The owner RPC is the only client-facing member-removal path. A database trigger rejects removed members on new expenses while allowing unchanged historical membership on existing expenses.

Local-only development mode keeps the same archival behavior. Browser storage is not a security boundary for local test data; production authorization is checked in the database.
