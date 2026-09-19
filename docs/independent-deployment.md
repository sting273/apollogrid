# Independent Cloudflare deployment

This runbook moves ApolloGrid from ChatGPT Sites to an independently owned Cloudflare Worker and D1 database. GitHub remains the source of code; D1 remains the source of customer records.

## One-time owner actions

1. Create a Cloudflare account and give Codex a browser login to it.
2. Create or choose a domain. Use a domain you control for production; do not use a `workers.dev` address for the admin dashboard.
3. Create a Resend account, verify a sender domain, and provide the API key plus the backup recipient address.
4. In Cloudflare Zero Trust, protect `/admin*` and `/api/admin/*` with an email one-time-passcode policy for the owner's email address.

## Deployment sequence

1. Create D1: `npx wrangler d1 create apollogrid`.
2. Set the returned database id as `CF_D1_DATABASE_ID` before building.
3. Apply the immutable SQL migrations in `drizzle/` to the new database.
4. Import the verified export from the current hosted D1.
5. Add Worker secrets: `IDEAL_POSTCODES_API_KEY`, `GOOGLE_MAPS_API_KEY`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `BACKUP_EMAIL_TO`, and `BACKUP_FROM_EMAIL`.
6. Set `CF_D1_DATABASE_ID` and run `npm run cf:deploy`. The deployment script prepares the generated Worker config, disables the bypassable `workers.dev` address, and installs the daily backup cron. Bind the custom domain, then verify customer calculation plus admin export.

## Backups

The Worker cron is fixed at `01:15 UTC` daily. It queries the five operational tables and emails a portable JSON attachment through Resend. This contains customer information: use a mailbox protected by MFA and retain the attachments securely. When the encoded attachment exceeds 18 MB, the task fails instead of silently sending an incomplete backup; migrate snapshots to R2 at that point.
