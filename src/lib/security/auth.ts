import type { AppEnv } from "@/lib/config/env";

export interface TelegramIdentity {
  userId: number;
  chatId: number;
}

export class AuthError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "AuthError";
  }
}

/** Validates the Telegram-provided secret header. Constant-time comparison. */
export function verifyWebhookSecret(
  headerValue: string | null | undefined,
  env: AppEnv
): boolean {
  if (!headerValue) return false;
  const expected = Buffer.from(env.TELEGRAM_WEBHOOK_SECRET, "utf8");
  const got = Buffer.from(headerValue, "utf8");
  if (expected.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    // We checked lengths; both buffers are safe to index with `i`.
    diff |= (expected[i] as number) ^ (got[i] as number);
  }
  return diff === 0;
}

export function assertAllowedIdentity(
  id: TelegramIdentity,
  env: AppEnv
): void {
  if (id.userId !== env.TELEGRAM_OWNER_USER_ID) {
    throw new AuthError(`user ${id.userId} is not the authorized owner`);
  }
  if (id.chatId !== env.TELEGRAM_ALLOWED_CHAT_ID) {
    throw new AuthError(`chat ${id.chatId} is not the authorized chat`);
  }
}
