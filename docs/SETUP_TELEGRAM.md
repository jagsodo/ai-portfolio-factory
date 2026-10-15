# Telegram setup

## 1. Create the bot

1. In Telegram, chat with [@BotFather](https://t.me/BotFather).
2. `/newbot`, pick a name and username.
3. BotFather returns a token like `1234567890:AA...` — this is `TELEGRAM_BOT_TOKEN`.

## 2. Discover your IDs

- Message your new bot once (any text).
- Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser.
- Record `message.from.id` as `TELEGRAM_OWNER_USER_ID`.
- Record `message.chat.id` as `TELEGRAM_ALLOWED_CHAT_ID` (equal to the user ID
  for a private DM).

## 3. Generate a webhook secret

Any long random string (≥ 16 chars):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save it as `TELEGRAM_WEBHOOK_SECRET` in Vercel and locally.

## 4. Register the webhook

After deploying to Vercel:

```bash
WEBHOOK_URL=https://<your-project>.vercel.app/api/telegram npm run register-webhook
```

Telegram will now call that URL with the secret in the
`X-Telegram-Bot-Api-Secret-Token` header. Any request without it is rejected
with 401.

## 5. First smoke test

In Telegram, send `/start`. You should get the welcome message. Then send
`/nuevo CRM mínimo con Next.js y SQLite`. The bot replies with a new GitHub
Issue number.
