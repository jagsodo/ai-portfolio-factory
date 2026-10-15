# Security

## Controls

- **Secret token check:** `verifyWebhookSecret()` compares the Telegram
  `X-Telegram-Bot-Api-Secret-Token` header with
  `TELEGRAM_WEBHOOK_SECRET` using a constant-time comparison.
- **Owner enforcement:** `assertAllowedIdentity()` rejects any user id or
  chat id not matching env.
- **Payload validation:** All inbound updates run through
  `TelegramUpdateSchema` (Zod). Oversized messages are rejected.
- **Replay / duplicate protection:** `update_id` deduplication using an
  atomic `SET NX EX` on Upstash Redis
  (`src/lib/security/idempotency.ts`). In-memory fallback is explicitly
  flagged as "development only" and logs a warning if it is used on Vercel
  production. If the backend is unreachable the webhook responds 500 so
  Telegram retries later rather than risking a double execution.
- **Input hardening:** `parseCommand()` rejects messages over 4096 chars,
  caps arguments to 2000 chars, and strips control characters before they
  reach GitHub issue bodies or labels.
- **Scoped GitHub token:** fine-grained PAT limited to the factory repo and
  minimum permissions.
- **No shell interpolation:** The webhook never shells out with user text.
- **Branch protection:** `main` requires human review; agent PRs are draft.
- **State machine enforcement:** All transitions validated via
  `canTransition()` — illegal transitions throw.
- **Workflow guardrails:** `.github/claude/task-prompt.md` tells Claude to
  avoid secrets, workflow files, cross-project edits, and false success
  claims.

## Known gaps

- The agent workflow uses `GITHUB_TOKEN` (job scoped). It is sufficient for
  Issues + PR creation on this repo. For multi-repo expansion a GitHub App
  is required.
- Claude Code is still an evolving official action. Validate the exact action
  inputs against `anthropics/claude-code-action` before each major upgrade.
- `/publicar` from Telegram only records the owner's intent; the actual
  merge/publish must happen manually in GitHub. The MVP intentionally does
  not expose a direct merge path to avoid bypassing branch protection.

## What to NEVER do

- Interpolate Telegram text into a shell command or a GitHub Actions `run:`
  block.
- Log tokens or secret headers.
- Give the GitHub token `admin` scopes.
- Treat an "approve" button click as sufficient to publish without a GitHub
  review.
