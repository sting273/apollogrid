# Road Show v2

Production entry: https://apollogridtest.online/road-show
Application: https://road-show-experiment.guoyiding273.chatgpt.site

## Access

QR registration is OFF by default (a missing `qr_required` setting means false).
Normal registration uses a company English name and creates a role-3 member.
Duplicate names are rejected case-insensitively. Use `Name_LeaderName`, or
`Name_LeaderName_02` for a further collision. Existing names are never automatically
claimed by the registration action. Name-only returning-member entry is explicitly
available for unverified role-3 accounts while QR mode is OFF. This is intentionally
a low-assurance internal experiment mode, not identity verification.

Thirty-day, HttpOnly, SameSite=Lax cookies retain sessions; production uses Secure.
Session tokens are random, stored as hashes, and not placed in localStorage.
Unsent record drafts and the language preference are device-local. Record storage
is partitioned by permanent account ID, not the display name.

The owner signs in through ChatGPT via `/admin-entry`. The server checks the
designated owner identity; a matching typed name or browser-supplied role never
grants administrative access. The existing Sites identity ID is retained so all
original owner records remain visible. Legacy records without member profiles
remain visible to the owner.

| Role | Account and record scope |
| --- | --- |
| 0 Owner | All records; all non-owner accounts; QR policy |
| 1 Store manager | Direct role-2 team leads and their role-3 members |
| 2 Team lead | Direct role-3 members |
| 3 Member | Own records only; no team endpoints |

Normal name-only registration never grants roles 0–2. The owner invites managers;
managers invite team leads; leads invite members. Invitations work before or after
QR enforcement is enabled. The owner can assign an existing role-3 member to a lead.

## QR mode

The owner-only settings switch is enforced on the server. Enabling it requires
new members AND previously unverified device sessions to redeem an invitation.
An authorised supervisor can issue a targeted recovery invitation for an existing
account; this keeps the account ID and existing records. New-device entry for
verified members also uses recovery invitations. Passkeys are NOT implemented.

Invitations expire after 24 hours, are single-use, revocable, and bind role, store,
and supervisor. The registration transaction claims the invite and creates the
account together. QR payloads are random tokens in URL fragments, not predictable
IDs or query parameters. Only token hashes persist. Anyone holding a valid invite
can redeem it: supervisors should hand it only to the intended person.

Account disable invalidates sessions and unused invitations issued by that account.
Renaming preserves the permanent ID and history. Merging role-3 duplicate accounts
transfers records, disables the source, and invalidates source sessions and target
recovery links. Management actions are audit-logged.

## Internationalisation and records

Browser language selects English or Chinese on first visit. The user can switch
at any time; entry, field collection, history, team controls and Excel headers are
bilingual. Existing user-entered names/notes are never machine-translated.

Step 1 has two separate sentence counters. Saving it unlocks all other steps.
Users can return and modify the same record without duplication. Optimistic
revisions protect concurrent updates; a conflict is preserved as a separate copy.
Excel contains Sessions/Counts (or Chinese equivalents), including member identity.

## Verification

Run the development server with `SITES_LOCAL_ADMIN_EMAIL=guoyiding273@outlook.com`
only for the local owner tests; the mock is development-only and absent in production.
Run `node scripts/check-v2.mjs` against localhost:5173. It exercises name registration,
duplicate handling, bilingual UI, 390px layout, offline edits, saved sessions, step
backfill, Excel, all role boundaries, invitations/replay, QR switch and recovery.
Tests create only local data; `.sites-runtime` and `.wrangler` are not published.

The companion Solar app is independently deployed to Cloudflare. Its `/road-show`
route and top navigation link to this application. The databases remain separate.
GitHub stores code and migrations, not user records or authentication tokens.
