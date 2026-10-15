import { describe, it, expect } from "vitest";
import { TelegramUpdateSchema } from "@/lib/telegram/schema";

describe("TelegramUpdateSchema", () => {
  it("parses a text message update", () => {
    const parsed = TelegramUpdateSchema.safeParse({
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: 42 },
        chat: { id: 42, type: "private" },
        date: 1,
        text: "/start"
      }
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects garbage", () => {
    const parsed = TelegramUpdateSchema.safeParse({ foo: "bar" });
    expect(parsed.success).toBe(false);
  });

  it("rejects oversized text", () => {
    const parsed = TelegramUpdateSchema.safeParse({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 1 },
        chat: { id: 1, type: "private" },
        date: 1,
        text: "x".repeat(5000)
      }
    });
    expect(parsed.success).toBe(false);
  });
});
