import { describe, it, expect } from "vitest";
import {
  createMemoryStoreForTests,
  telegramUpdateKey
} from "@/lib/security/idempotency";

describe("idempotency store (memory)", () => {
  it("accepts a key the first time only", async () => {
    const store = createMemoryStoreForTests();
    const key = telegramUpdateKey(123);
    expect(await store.claim(key)).toBe(true);
    expect(await store.claim(key)).toBe(false);
    expect(await store.claim(key)).toBe(false);
  });

  it("treats distinct update ids independently", async () => {
    const store = createMemoryStoreForTests();
    expect(await store.claim(telegramUpdateKey(1))).toBe(true);
    expect(await store.claim(telegramUpdateKey(2))).toBe(true);
    expect(await store.claim(telegramUpdateKey(1))).toBe(false);
  });

  it("produces stable keys per update id", () => {
    expect(telegramUpdateKey(42)).toBe("tg:update:42");
  });
});
