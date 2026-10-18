import { NextRequest, NextResponse } from "next/server";
import { getEnv, getRepoParts } from "@/lib/config/env";
import { verifyWebhookSecret, assertAllowedIdentity, AuthError } from "@/lib/security/auth";
import { TelegramUpdateSchema } from "@/lib/telegram/schema";
import { createTelegramClient } from "@/lib/telegram/client";
import { getOctokit } from "@/lib/github/client";
import { TaskService } from "@/modules/tasks/service";
import { AgentDispatcher } from "@/modules/agent/dispatcher";
import { handleCommand, handleCallback } from "@/modules/agent/commands";
import {
  getIdempotencyStore,
  telegramUpdateKey
} from "@/lib/security/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    console.error("[telegram] env error", (err as Error).message);
    return NextResponse.json({ ok: false, error: "misconfigured" }, { status: 500 });
  }

  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretHeader, env)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const parsed = TelegramUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid-update" }, { status: 400 });
  }
  const update = parsed.data;

  try {
    const store = getIdempotencyStore();
    const first = await store.claim(telegramUpdateKey(update.update_id));
    if (!first) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  } catch (err) {
    // Fail closed: if the dedupe backend is unreachable we return 500 so
    // Telegram retries later rather than risking a duplicate execution.
    const message = (err as Error).message;
    console.error("[telegram] idempotency backend error:", message);
    return NextResponse.json({ ok: false, error: "idempotency-unavailable", detail: message }, { status: 500 });
  }

  const telegram = createTelegramClient(env);
  const octokit = getOctokit(env);
  const { owner, repo } = getRepoParts(env);
  const tasks = new TaskService({ octokit, owner, repo });
  const dispatcher = new AgentDispatcher({ octokit, owner, repo, ref: env.GITHUB_DEFAULT_BRANCH });

  try {
    if (update.message) {
      const msg = update.message;
      const from = msg.from;
      if (!from) {
        return NextResponse.json({ ok: true, skipped: "no-from" });
      }
      assertAllowedIdentity({ userId: from.id, chatId: msg.chat.id }, env);
      const text = msg.text ?? "";
      await handleCommand(
        { chatId: msg.chat.id, userId: from.id, tasks, dispatcher, telegram },
        text
      );
    } else if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id ?? cq.from.id;
      assertAllowedIdentity({ userId: cq.from.id, chatId }, env);
      await handleCallback(
        { chatId, userId: cq.from.id, tasks, dispatcher, telegram },
        cq.data ?? "",
        cq.id
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      console.warn("[telegram] auth rejection:", err.reason);
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    console.error("[telegram] handler error:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
