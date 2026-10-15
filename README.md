# AI Portfolio Factory

Autonomous software development agent controlled from Telegram. The controller
runs on Vercel (Next.js), stores task state in GitHub Issues, and offloads all
long-running work to GitHub Actions running Claude Code.

> **Status:** Phase 1 (MVP) scaffold. The code compiles, the webhook rejects
> unauthenticated traffic, task creation uses GitHub Issues, and the Claude
> workflow is wired up. End-to-end validation requires live secrets you supply
> yourself — see the setup docs.

## Flow

```
Telegram -> Vercel (/api/telegram) -> GitHub Issues (tasks) + workflow_dispatch
         -> GitHub Actions -> Claude Code -> branch + PR -> Telegram report
```

## Repository layout

```
app/api/telegram        Webhook endpoint (Zod validation + auth)
app/api/health          Liveness probe
src/lib                 config, telegram, github, security
src/modules             tasks, agent dispatcher, commands
.github/workflows       agent.yml (dispatch), daily.yml (schedule), ci.yml
.github/claude          Prompt used by Claude Code in the agent workflow
scripts                 register-webhook, notify-telegram
projects                Future home of generated projects (one subfolder each)
tests                   Vitest suite (security, state machine, schema, commands)
docs                    Setup, security, operations, troubleshooting
```

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run typecheck
npm test
npm run dev
```

The dev server will refuse requests to `/api/telegram` without a correct
`X-Telegram-Bot-Api-Secret-Token` header.

## Deploying

See [docs/SETUP_VERCEL.md](docs/SETUP_VERCEL.md), [docs/SETUP_GITHUB.md](docs/SETUP_GITHUB.md),
and [docs/SETUP_TELEGRAM.md](docs/SETUP_TELEGRAM.md).

## What is NOT connected yet

Nothing in this repo talks to Telegram, GitHub, or Claude until **you** add
the secrets described in [docs/SETUP_TELEGRAM.md](docs/SETUP_TELEGRAM.md),
[docs/SETUP_GITHUB.md](docs/SETUP_GITHUB.md), and
[docs/SETUP_VERCEL.md](docs/SETUP_VERCEL.md). The CI pipeline runs typecheck,
unit tests, and a build with placeholder values to prove the controller is
healthy without real credentials.
