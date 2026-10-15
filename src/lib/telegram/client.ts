import type { AppEnv } from "@/lib/config/env";

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface SendMessageOptions {
  chatId: number;
  text: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  inlineKeyboard?: InlineKeyboardButton[][];
  disableWebPagePreview?: boolean;
}

export interface TelegramApi {
  sendMessage(opts: SendMessageOptions): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  setWebhook(url: string, secret: string): Promise<unknown>;
}

/** Real Telegram client. Isolated behind an interface so tests can inject a fake. */
export function createTelegramClient(env: AppEnv): TelegramApi {
  const base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

  async function post(method: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (!res.ok || data.ok === false) {
      throw new Error(
        `Telegram API ${method} failed: ${res.status} ${data.description ?? ""}`.trim()
      );
    }
    return data;
  }

  return {
    async sendMessage(opts) {
      await post("sendMessage", {
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode,
        disable_web_page_preview: opts.disableWebPagePreview ?? true,
        reply_markup: opts.inlineKeyboard
          ? { inline_keyboard: opts.inlineKeyboard }
          : undefined
      });
    },
    async answerCallbackQuery(id, text) {
      await post("answerCallbackQuery", { callback_query_id: id, text });
    },
    async setWebhook(url, secret) {
      return post("setWebhook", {
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"]
      });
    }
  };
}
