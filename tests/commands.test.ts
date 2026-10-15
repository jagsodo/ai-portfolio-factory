import { describe, it, expect, vi } from "vitest";
import { parseCommand, handleCommand } from "@/modules/agent/commands";
import type { TaskRecord } from "@/modules/tasks/service";

describe("parseCommand", () => {
  it("parses /nuevo with args", () => {
    expect(parseCommand("/nuevo hola mundo")).toEqual({ command: "nuevo", args: "hola mundo" });
  });

  it("strips bot mentions", () => {
    expect(parseCommand("/start@MyBot")).toEqual({ command: "start", args: "" });
  });

  it("returns null for plain text", () => {
    expect(parseCommand("hola")).toBeNull();
  });
});

function buildCtx(overrides: Partial<{ task: TaskRecord | null }> = {}) {
  const sent: Array<{ text: string }> = [];
  const task: TaskRecord | null = overrides.task === undefined ? null : overrides.task;
  const createdTasks: unknown[] = [];
  return {
    sent,
    createdTasks,
    ctx: {
      chatId: 42,
      userId: 42,
      telegram: {
        sendMessage: vi.fn(async (opts: { chatId: number; text: string }) => {
          sent.push({ text: opts.text });
        }),
        answerCallbackQuery: vi.fn(async () => {}),
        setWebhook: vi.fn(async () => ({}))
      },
      tasks: {
        createTask: vi.fn(async (input: unknown) => {
          createdTasks.push(input);
          return {
            id: 101,
            title: "t",
            body: "",
            state: "PENDING_APPROVAL",
            priority: "normal",
            project: null,
            labels: [],
            htmlUrl: "https://example/101",
            updatedAt: ""
          } satisfies TaskRecord;
        }),
        getTask: vi.fn(async () => task),
        listOpenTasks: vi.fn(async () => (task ? [task] : [])),
        setState: vi.fn(async () => task as TaskRecord),
        addComment: vi.fn(async () => {})
      },
      dispatcher: { dispatch: vi.fn(async () => {}) }
    }
  };
}

describe("handleCommand", () => {
  it("/start replies", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "/start");
    expect(sent.at(-1)?.text).toContain("AI Portfolio Factory");
  });

  it("/help lists commands", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "/help");
    expect(sent.at(-1)?.text).toContain("/nuevo");
  });

  it("/nuevo without args warns", async () => {
    const { ctx, sent, createdTasks } = buildCtx();
    await handleCommand(ctx as never, "/nuevo");
    expect(sent.at(-1)?.text).toContain("Uso:");
    expect(createdTasks).toHaveLength(0);
  });

  it("/nuevo creates a task", async () => {
    const { ctx, createdTasks, sent } = buildCtx();
    await handleCommand(ctx as never, "/nuevo CRM pequeño con Next.js");
    expect(createdTasks).toHaveLength(1);
    expect(sent.at(-1)?.text).toContain("#101");
  });

  it("unknown command replies with help hint", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "/bogus");
    expect(sent.at(-1)?.text).toContain("no reconocido");
  });

  it("plain text message gets fallback", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "hola");
    expect(sent.at(-1)?.text.toLowerCase()).toContain("idea");
  });
});
