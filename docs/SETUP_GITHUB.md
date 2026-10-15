# GitHub setup

## 1. Create the repository

Push this project to a new GitHub repository (public or private). Keep the
default branch as `main`.

## 2. Branch protection

In **Settings → Branches**, protect `main`:

- Require pull request reviews before merging.
- Dismiss stale approvals on push.
- Require conversation resolution.
- Disallow force pushes.

This prevents the agent from merging its own PRs.

## 3. Required labels

Create these labels (the TaskService also creates them lazily when it writes
issues, but creating them up front is cleaner):

- `ai-portfolio-factory`
- `state:IDEA`, `state:PENDING_APPROVAL`, `state:APPROVED`, `state:QUEUED`,
  `state:RUNNING`, `state:BLOCKED`, `state:FAILED`, `state:IN_REVIEW`,
  `state:COMPLETED`, `state:PUBLISHED`, `state:PAUSED`
- `priority:low`, `priority:normal`, `priority:high`

## 4. Fine-grained PAT

For Vercel to call GitHub, create a fine-grained PAT:

- Repository access: only this repository.
- Repository permissions:
  - **Issues:** Read & Write
  - **Pull requests:** Read
  - **Contents:** Read
  - **Actions:** Read & Write (to call `workflow_dispatch`)
  - **Metadata:** Read

Save it as `GITHUB_TOKEN` in Vercel env vars.

## 5. GitHub Actions secrets

Under **Settings → Secrets and variables → Actions**, add:

- `TELEGRAM_BOT_TOKEN` — same bot token as Vercel.
- `TELEGRAM_ALLOWED_CHAT_ID` — your chat id.
- Exactly **one** of:
  - `ANTHROPIC_API_KEY`, or
  - `CLAUDE_CODE_OAUTH_TOKEN` (if your plan supports it; see Anthropic's
    official `anthropics/claude-code-action` README for the current list).

The `agent.yml` workflow fails with a clear error if both are empty.

## 6. Repository Actions settings (CRITICAL)

Under **Settings → Actions → General**:

1. **Workflow permissions** → "Read and write permissions". The job-level
   `permissions:` block in each workflow narrows this back down, so no new
   privilege is granted — but *disabling* this toggles blocks the agent even
   if the job declares `pull-requests: write`.
2. **Allow GitHub Actions to create and approve pull requests** → **ON**.
   Without this, `GITHUB_TOKEN` cannot open the draft PR and the agent
   workflow logs a warning plus a `compare` fallback URL.

Note: GitHub's own policy forbids `GITHUB_TOKEN` from *approving* its own
PRs. The agent never approves; a human reviewer must approve and merge.

## 7. Repository variables

Under **Settings → Secrets and variables → Actions → Variables**:

- `AGENT_MAX_TURNS` — default 25. Caps the Claude Code session length.
- `DAILY_ENABLED` — set to `true` to activate the daily scheduler. It
  **ships off**: the scheduled run exits with no action until this is set,
  so the first end-to-end test must be initiated manually with
  `/iniciar <id>` from Telegram.

## 8. Pause switch

To pause the daily scheduler, open an issue titled exactly `agent:paused`.
Close it to resume.
