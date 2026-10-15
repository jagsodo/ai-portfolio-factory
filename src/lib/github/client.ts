import { Octokit } from "@octokit/rest";
import type { AppEnv } from "@/lib/config/env";

let cached: Octokit | null = null;

export function getOctokit(env: AppEnv): Octokit {
  if (cached) return cached;
  cached = new Octokit({
    auth: env.GITHUB_TOKEN,
    userAgent: "ai-portfolio-factory/0.1"
  });
  return cached;
}

export function __setOctokitForTests(client: Octokit | null): void {
  cached = client;
}
