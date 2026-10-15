# Troubleshooting

## The bot does not answer

- Vercel deployment healthy? Visit `/api/health`.
- Webhook registered? `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.
- Look at Vercel runtime logs. Any `invalid-update` or `forbidden`?
- Confirm your user id matches `TELEGRAM_OWNER_USER_ID`.

## `/nuevo` creates nothing

- The webhook returns 500 if GitHub rejects the issue create call. Check:
  - `GITHUB_TOKEN` is valid and has **Issues: write**.
  - `GITHUB_REPO` exactly matches `owner/repo`.
  - Required labels exist (or let the API create them lazily).

## Claude workflow fails immediately

- "Neither ANTHROPIC_API_KEY nor CLAUDE_CODE_OAUTH_TOKEN is configured" →
  add exactly one of the two as a repository secret.
- Rate limited / quota exceeded → check Anthropic console; the workflow has
  no retry loop by design.

## Daily workflow does nothing

- An open issue titled `agent:paused` exists.
- There are no open issues with the `ai-portfolio-factory` label and one of
  the eligible state labels (`APPROVED`, `QUEUED`, `BLOCKED`, `FAILED`).

## Agent opened a PR but tests failed

- Expected: the PR stays as draft, the task moves to `IN_REVIEW`, and a
  Telegram message says Claude succeeded but tests failed. Review manually.

## Updating from VS Code

- Edit, commit, push to a feature branch.
- Open a PR against `main`. CI runs typecheck + tests + build.
- Merge after review. Vercel re-deploys automatically.
