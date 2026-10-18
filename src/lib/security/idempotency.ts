/**
 * Persistent, atomic idempotency check for the Telegram webhook.
 *
 * Vercel serverless invocations are stateless: in-memory sets do not survive
 * cold starts and cannot deduplicate across concurrent instances. We therefore
 * use Upstash Redis's REST API — it is HTTP-based (works fine from Vercel
 * Hobby), gives us an atomic SET NX, and has a free tier (10,000 commands/day
 * at the time of writing, 500K/month on the paid upgrade path).
 *
 * Required env vars (configure in Vercel Project Settings → Environment
 * Variables) when IDEMPOTENCY_BACKEND=redis:
 *   UPSTASH_REDIS_REST_URL      https://<db>.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN    read/write token
 *
 * If IDEMPOTENCY_BACKEND is unset (or set to "memory"), we fall back to a
 * best-effort in-memory Set. This is only safe for local development; it is
 * logged loudly in production so you don't silently deploy a non-idempotent
 * webhook.
 */

export interface IdempotencyStore {
  /** Returns true if this is the first time we see `key`, false if seen. */
  claim(key: string): Promise<boolean>;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h

class MemoryStore implements IdempotencyStore {
  private readonly seen = new Set<string>();
  private readonly max = 500;

  async claim(key: string): Promise<boolean> {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > this.max) {
      const first = this.seen.values().next().value;
      if (typeof first === "string") this.seen.delete(first);
    }
    return true;
  }
}

class UpstashRedisStore implements IdempotencyStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS
  ) {}

  async claim(key: string): Promise<boolean> {
    // Upstash REST: /set/<key>/<value>?NX=true&EX=<seconds>
    // Returns { result: "OK" } on first write, { result: null } on duplicate.
    const encodedKey = encodeURIComponent(key);
    const url = `${this.url}/set/${encodedKey}/1?NX=true&EX=${this.ttlSeconds}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}` }
    });
    if (!res.ok) {
      throw new Error(`Upstash SET NX failed: ${res.status}`);
    }
    const data = (await res.json()) as { result: string | null };
    return data.result === "OK";
  }
}

let cached: IdempotencyStore | null = null;

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  // Vercel's "copy from Upstash" sometimes brings surrounding quotes or trailing
  // whitespace. Strip them so one accidental Ctrl+V doesn't break the store.
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

export function getIdempotencyStore(): IdempotencyStore {
  if (cached) return cached;
  const backend = (process.env.IDEMPOTENCY_BACKEND ?? "memory").toLowerCase().trim();
  if (backend === "redis") {
    const url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL);
    const token = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
    if (!url || !token) {
      throw new Error(
        `IDEMPOTENCY_BACKEND=redis but UPSTASH_REDIS_REST_URL (${url ? "set" : "MISSING"}) / UPSTASH_REDIS_REST_TOKEN (${token ? "set" : "MISSING"}) are not usable.`
      );
    }
    if (!/^https:\/\//.test(url)) {
      throw new Error(`UPSTASH_REDIS_REST_URL does not look like an https URL (got ${url.length} chars starting with "${url.slice(0, 10)}").`);
    }
    cached = new UpstashRedisStore(url, token);
  } else {
    if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production") {
      console.warn(
        "[idempotency] Running on Vercel without a persistent backend. Set IDEMPOTENCY_BACKEND=redis and the UPSTASH_REDIS_REST_* vars to deduplicate updates reliably."
      );
    }
    cached = new MemoryStore();
  }
  return cached;
}

export function __setIdempotencyStoreForTests(store: IdempotencyStore | null): void {
  cached = store;
}

/** Test helper: a fresh in-memory store, independent from the module cache. */
export function createMemoryStoreForTests(): IdempotencyStore {
  return new MemoryStore();
}

export function telegramUpdateKey(updateId: number): string {
  return `tg:update:${updateId}`;
}
