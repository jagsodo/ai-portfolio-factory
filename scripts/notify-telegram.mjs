// Posts a short run summary from GitHub Actions to Telegram.
// Reads env: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_ID, CLAUDE_OUTCOME,
// TESTS_OUTCOME, PR_URL, TASK_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY,
// GITHUB_RUN_ID.

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
if (!token || !chatId) {
  console.log("Telegram secrets missing; skipping notification.");
  process.exit(0);
}

const claude = process.env.CLAUDE_OUTCOME || "unknown";
const tests = process.env.TESTS_OUTCOME || "unknown";
const prUrl = process.env.PR_URL || "(no PR)";
const taskId = process.env.TASK_ID || "?";
const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

const text = [
  `AI Portfolio Factory — tarea #${taskId}`,
  `Claude: ${claude}`,
  `Pruebas: ${tests}`,
  `PR: ${prUrl}`,
  `Run: ${runUrl}`,
  "",
  "Revisión humana requerida antes de mergear."
].join("\n");

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chat_id: Number(chatId),
    text,
    disable_web_page_preview: true
  })
});
if (!res.ok) {
  console.error("Telegram notify failed:", res.status, await res.text());
  process.exit(0); // never fail the workflow on notification errors
}
