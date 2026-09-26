# ApolloGrid solar assessment

## Road Show Experiment

The homepage navigation and `/road-show` route link to the field experiment app:
https://road-show-experiment.guoyiding273.chatgpt.site . Its source is included in
`road-show/` as an independently deployed app with its own D1 database. See
`road-show/docs/road-show-v2.md` for roles, name-only entry, optional QR registration,
Chinese/English UI, offline drafts, Excel export and verification. QR enforcement is
OFF by default and can only be changed by the Road Show owner. Solar records and
Road Show records remain in their respective databases.

Build and test this Solar app separately from `road-show/`.

ApolloGrid is a public UK solar assessment for customers and an authenticated operations dashboard for the team. Customer measurements, survey requests and API activity are stored in Cloudflare D1.

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm ci
copy .env.example .env
npm run dev
```

Open `http://127.0.0.1:3000/` for the calculator and `http://127.0.0.1:3000/admin` for the local dashboard.

Configure these values in `.env`; never commit this file.

```dotenv
IDEAL_POSTCODES_API_KEY=
GOOGLE_MAPS_API_KEY=
ADMIN_EMAILS=owner@example.com
```

`ADMIN_EMAILS` is a comma-separated allowlist for the hosted operations dashboard. The local server uses an isolated development identity so the dashboard remains usable without copying a personal email into source control.

## Production architecture

- The public calculator and operations dashboard run as a Cloudflare Worker.
- Cloudflare D1 is the authoritative shared database for every device.
- The `drizzle/` directory contains append-only schema migrations. Production schema changes are made through migrations, never by application requests.
- Provider keys and the administrator allowlist are hosted secrets. They must not be placed in GitHub or `.openai/hosting.json`.

The `/admin` route asks the operator to sign in with ChatGPT and allows only an address in `ADMIN_EMAILS`. The public calculator does not require sign-in.

## Moving to another Mac or PC

Sign in to Codex with the same ChatGPT account, then clone the private repository and open the cloned folder in Codex:

```bash
git clone https://github.com/sting273/apollogrid.git
cd apollogrid
npm ci
cp .env.example .env
npm run dev
```

On Windows PowerShell, replace `cp .env.example .env` with `Copy-Item .env.example .env`.

For local postcode and Google Solar lookups, put the provider keys in that device's untracked `.env` file. Do not copy or commit `.env` to GitHub. The hosted site already has its own secrets and runs independently at the production URL.

All customer measurements and bookings made through the hosted site go to Cloudflare D1 immediately. GitHub stores source code and migration history; it is not the customer-data transport. Open the hosted `/admin` page on any signed-in device to see the shared records.

## Verification

```bash
npm test
npx tsc --noEmit
```

`npm test` builds the Worker and runs the calculation, rendering and assessment-save tests.
