# Vercel deployment

## 1. Import the repo

- vercel.com → **Add New Project** → import this GitHub repository.
- Framework preset: **Next.js** (auto-detected).
- Node.js version: 20.

## 2. Environment variables

In **Project → Settings → Environment Variables** add every variable from
`.env.example`. Use the real values. Set them for *Production* **and**
*Preview* if you plan to test preview deployments.

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_WEBHOOK_SECRET` | Long random string you generated |
| `TELEGRAM_OWNER_USER_ID` | Your numeric Telegram user id |
| `TELEGRAM_ALLOWED_CHAT_ID` | Your numeric Telegram chat id |
| `GITHUB_TOKEN` | Fine-grained PAT limited to the factory repo |
| `GITHUB_REPO` | `owner/ai-portfolio-factory` |
| `GITHUB_DEFAULT_BRANCH` | `main` |
| `AGENT_MAX_TURNS` | optional, default 25 |
| `IDEMPOTENCY_BACKEND` | **`redis`** in production (required) |
| `UPSTASH_REDIS_REST_URL` | from Upstash console → "REST URL" |
| `UPSTASH_REDIS_REST_TOKEN` | from Upstash console → "REST Token" |

### Why Upstash Redis is required in production

Vercel serverless functions are stateless. The webhook deduplicates Telegram
updates by their `update_id` (Telegram retries on 5xx). An in-memory `Set`
inside a single function instance **does not** work across cold starts or
concurrent instances — the same update could execute twice.

Upstash Redis exposes an atomic `SET NX EX` over HTTPS (no TCP connection
reuse required, perfect for serverless). The free tier at the time of
writing offers 10,000 commands/day and 256 MB storage, which comfortably
covers a personal bot.

**Setup:**

1. Create an account at <https://console.upstash.com>.
2. Create a Redis database. Pick a region close to your Vercel region
   (e.g. `us-east-1`). Enable "Global" if you want multi-region replication.
3. On the database page copy "UPSTASH_REDIS_REST_URL" and
   "UPSTASH_REDIS_REST_TOKEN".
4. Paste both into Vercel project env vars.
5. Set `IDEMPOTENCY_BACKEND=redis`.

If `IDEMPOTENCY_BACKEND` is unset, the webhook logs a warning but falls
back to in-memory dedupe — safe only for local development.

## 3. Deploy and smoke test

- Deploy. Visit `https://<project>.vercel.app/api/health` — expect
  `{ ok: true, ... }`.
- Hit `/api/telegram` without the secret header — expect `401`.

## 4. Register webhook

Locally, with the same `.env.local`:

```bash
WEBHOOK_URL=https://<project>.vercel.app/api/telegram npm run register-webhook
```

## 5. Hobby plan limits to respect

- Serverless function timeout 10s on Hobby. The webhook never blocks on
  Claude; it dispatches and returns.
- No cron on Hobby for custom routes — the daily scheduling lives in GitHub
  Actions `daily.yml`, not Vercel.
