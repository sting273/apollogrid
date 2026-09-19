# ApolloGrid solar assessment

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

## Verification

```bash
npm test
npx tsc --noEmit
```

`npm test` builds the Worker and runs the calculation, rendering and assessment-save tests.
