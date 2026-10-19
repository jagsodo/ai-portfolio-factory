import { describe, it, expect } from "vitest";
import { verifyWebhookSecret, assertAllowedIdentity, AuthError } from "@/lib/security/auth";
import type { AppEnv } from "@/lib/config/env";

const env: AppEnv = {
  TELEGRAM_BOT_TOKEN: "x",
  TELEGRAM_WEBHOOK_SECRET: "super-secret-value-123",
  TELEGRAM_OWNER_USER_ID: 42,
  TELEGRAM_ALLOWED_CHAT_ID: 42,
  GITHUB_TOKEN: "x",
  GITHUB_REPO: "o/r",
  GITHUB_DEFAULT_BRANCH: "main",
  ANTHROPIC_API_KEY: "",
  CLAUDE_CODE_OAUTH_TOKEN: "",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "gemini-flash-latest",
  AGENT_MAX_TURNS: 25,
  AGENT_DAILY_LIMIT: 1
};

describe("verifyWebhookSecret", () => {
  it("accepts matching secret", () => {
    expect(verifyWebhookSecret("super-secret-value-123", env)).toBe(true);
  });

  it("rejects empty header", () => {
    expect(verifyWebhookSecret(null, env)).toBe(false);
    expect(verifyWebhookSecret("", env)).toBe(false);
  });

  it("rejects wrong secret", () => {
    expect(verifyWebhookSecret("super-secret-value-124", env)).toBe(false);
    expect(verifyWebhookSecret("short", env)).toBe(false);
  });
});

describe("assertAllowedIdentity", () => {
  it("passes for the owner in the allowed chat", () => {
    expect(() => assertAllowedIdentity({ userId: 42, chatId: 42 }, env)).not.toThrow();
  });

  it("rejects strangers", () => {
    expect(() => assertAllowedIdentity({ userId: 1, chatId: 42 }, env)).toThrow(AuthError);
  });

  it("rejects foreign chat even if user is owner", () => {
    expect(() => assertAllowedIdentity({ userId: 42, chatId: 7 }, env)).toThrow(AuthError);
  });
});
