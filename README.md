# Mail App (SvelteKit + Supabase + Gmail API)

Single fullstack app (one deploy) that renders a Gmail-like UI and provides server routes for:

- Inbox UI: `/inbox`
- Thread UI: `/thread/[threadId]`
- Compose UI: `/compose`
- Tracking pixel: `/track/[trackingId].png`
- Gmail sync: `/api/sync` (protected)
- Send/reply: `/api/send` (protected)

## Free-tier stack

- Hosting: Cloudflare Pages (free)
- DB: Supabase Postgres (free)
- Gmail API: Google (free quota for most personal usage)
- “Cron”: GitHub Actions scheduled workflow (free for public repos; limited free minutes for private)

Important: if Cloudflare Email Routing is configured to **drop** mail to `noreply@...`, no system can fetch those messages later. To see them here, change routing to forward/store them somewhere you can access.

## Local dev

1. Copy env template

```sh
cp .env.example .env
```

2. Install deps + run

```sh
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project (free)
2. In the SQL editor, run:

- [supabase/schema.sql](supabase/schema.sql)

For single-user auth (owner lock), also run:

- [supabase/auth_single_user.sql](supabase/auth_single_user.sql)

3. In Project Settings → API, grab:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Put them into `.env` (server-only).

## Session

Set `SESSION_SECRET` in your environment (a long random string). This signs the httpOnly session cookie.

## Gmail API setup (OAuth refresh token)

This app uses a Gmail API OAuth refresh token (recommended scopes include `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`).

Set these in `.env`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

`GOOGLE_REFRESH_TOKEN` is optional:

- If set, the server will use it.
- If not set, the first successful owner login will store a refresh token in Supabase (`mail_app_user.gmail_refresh_token`), and the server will use that.

### Google OAuth client settings (Option 2: sign-in flow)

In Google Cloud Console → Credentials → “OAuth client ID” (Web application):

**Authorized JavaScript origins**

- `http://localhost:5173`
- `https://mail.domain.com`

**Authorized redirect URIs**

- `http://localhost:5173/auth/google/callback`
- `https://mail.domain.com/auth/google/callback`

This project implements:

- `/auth/google/start`
- `/auth/google/callback`

The first successful login becomes the “owner” and is stored in `mail_app_user`.

## Protected endpoints

## Cloudflare Email Worker (optional)

If you want your domain mailboxes to deliver into this app (and optionally also forward to Gmail), use the Email Worker in:

- [email-worker/src/worker.js](email-worker/src/worker.js)
- [email-worker/wrangler.toml](email-worker/wrangler.toml)

The worker POSTs inbound RFC822 messages to:

- `POST /api/inbound/email` with header `x-email-routing-secret`

Set this in the app environment:

- `EMAIL_ROUTING_SECRET`

- `GET /api/sync` requires header `x-sync-secret: $SYNC_SECRET`
- `POST /api/send` requires header `x-api-key: $API_KEY`

## Deploy to Cloudflare Pages

1. Push this repo to GitHub
2. In Cloudflare Pages:

- Framework preset: SvelteKit
- Build command: `npm run build`
- Build output directory: `.svelte-kit/cloudflare`

3. Add env vars (Pages → Settings → Environment variables):

- Copy everything from `.env` (don’t add `.env` to git)

4. Add custom domain: `mail.domain.com`

## Free scheduled sync

This project includes a GitHub Actions cron that calls `/api/sync`:

- [./.github/workflows/sync.yml](.github/workflows/sync.yml)

Set GitHub repo secrets:

- `MAIL_APP_URL` = `https://mail.domain.com`
- `SYNC_SECRET` = same value as your deployed `SYNC_SECRET`
