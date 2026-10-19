import { z } from "zod";

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
  TELEGRAM_OWNER_USER_ID: z.coerce.number().int().positive(),
  TELEGRAM_ALLOWED_CHAT_ID: z.coerce.number().int(),
  GITHUB_TOKEN: z.string().min(10),
  GITHUB_REPO: z
    .string()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'GITHUB_REPO must look like "owner/repo"'),
  GITHUB_DEFAULT_BRANCH: z.string().default("main"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-flash-latest"),
  AGENT_MAX_TURNS: z.coerce.number().int().positive().default(25),
  AGENT_DAILY_LIMIT: z.coerce.number().int().positive().default(1)
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: force a specific env snapshot without reading process.env. */
export function __setEnvForTests(env: Partial<AppEnv>): AppEnv {
  cached = { ...(cached ?? ({} as AppEnv)), ...(env as AppEnv) };
  return cached;
}

export function __clearEnvForTests(): void {
  cached = null;
}

export function getRepoParts(env: AppEnv): { owner: string; repo: string } {
  const [owner, repo] = env.GITHUB_REPO.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPO value: ${env.GITHUB_REPO}`);
  }
  return { owner, repo };
}
