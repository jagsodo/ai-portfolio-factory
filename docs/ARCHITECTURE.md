# Architecture

## Components

| Component | Where | Responsibility |
|-----------|-------|----------------|
| Telegram Bot | Telegram | User interface |
| Vercel controller | `app/api/telegram` | Validate request, parse command, update tasks, dispatch workflow |
| GitHub Issues | GitHub | Persistent task store and state machine |
| GitHub Actions `agent.yml` | GitHub | Long-running Claude Code execution, PR creation |
| GitHub Actions `daily.yml` | GitHub | Scheduled picker that chooses one task per day |
| GitHub Actions `ci.yml` | GitHub | Typecheck + tests + build on push/PR |

## Why Vercel is only the thin webhook

Vercel Hobby serverless functions have short execution budgets (10s on Hobby
plans). Claude Code sessions take minutes. The webhook therefore only:

1. verifies the Telegram secret header and the owner identity,
2. validates the payload with Zod,
3. updates GitHub Issues state,
4. dispatches `agent.yml` via `workflow_dispatch` when a run is required,
5. replies to Telegram with a short acknowledgement.

Any real reasoning happens inside GitHub Actions, where Claude runs under
either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (never both — the
workflow picks one and errors if neither is set).

## State machine

Defined in `src/modules/tasks/states.ts`. Encoded in GitHub as a
`state:<NAME>` label plus the project-wide `ai-portfolio-factory` label.
Transitions are validated through `canTransition()` / `assertTransition()`.

```
IDEA → PENDING_APPROVAL → APPROVED → QUEUED → RUNNING → IN_REVIEW → COMPLETED → PUBLISHED
                                           ↘ BLOCKED / FAILED (retry) / PAUSED
```

## Why GitHub Issues as the "database"

- Already persistent, versioned, and auditable.
- Zero extra infrastructure or cost.
- Labels encode state and priority.
- Comments encode the execution history.

A dedicated database can be added later for metrics, but it is not required
for the MVP.

## Security boundaries

- Only the configured Telegram owner can act. See `src/lib/security/auth.ts`.
- Secrets live in Vercel env vars and GitHub Actions secrets.
- The Claude workflow uses a scoped `GITHUB_TOKEN` (not a classic PAT with
  admin rights). The repo should enable branch protection on `main` so the
  agent cannot bypass review.
- Pull requests from the agent are opened as drafts, require human merge.
- `/publicar` from Telegram only records intent; the actual merge is a
  manual action in GitHub.
