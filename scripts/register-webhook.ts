/**
 * One-off script to register the Telegram webhook pointing at your Vercel
 * deployment. Reads env (dotenv-free; expects variables already exported).
 *
 * Usage:
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram npm run register-webhook
 */
import { getEnv } from "@/lib/config/env";
import { createTelegramClient } from "@/lib/telegram/client";

async function main(): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error("Set WEBHOOK_URL=https://<deployment>/api/telegram");
  const env = getEnv();
  const client = createTelegramClient(env);
  const res = await client.setWebhook(url, env.TELEGRAM_WEBHOOK_SECRET);
  console.log("Webhook registered:", res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
