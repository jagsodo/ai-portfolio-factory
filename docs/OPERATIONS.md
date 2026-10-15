# Operations

## Daily routine

- **Off by default.** The scheduled run exits with no action until the
  repository variable `DAILY_ENABLED=true` is set
  (Settings → Secrets and variables → Actions → Variables). This is a hard
  gate so the first end-to-end integration test is always a manual
  `/iniciar <id>` from Telegram.
- Once enabled: `08:15 America/Bogota` → GitHub Actions `daily.yml` triggers.
- It skips if an open issue titled `agent:paused` exists.
- Priority order: `BLOCKED` → `FAILED` → `APPROVED` → `QUEUED`.
- Within a state, `priority:high` beats `priority:normal` beats
  `priority:low`.
- Picks exactly one task and calls `workflow_dispatch` on `agent.yml`.

## Pausing

- Create an open issue titled exactly `agent:paused`.
- From Telegram, `/pausar` reminds you to do that.
- Running jobs are not killed; cancel them manually from the Actions tab if
  needed.

## Resuming

- Close the `agent:paused` issue, or use `/reanudar` and then close it.

## Costs

- Claude Code tokens via `ANTHROPIC_API_KEY` or your Claude Code plan.
- GitHub Actions minutes (free tier is 2000/month on private repos; unlimited
  on public).
- Vercel Hobby bandwidth and function invocations.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
