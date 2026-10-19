import { describe, it, expect, vi } from "vitest";
import { handleCommand } from "@/modules/agent/commands";
import {
  parseGeminiOutput,
  wrapDraft,
  extractLatestDraft,
  DRAFT_OPEN,
  DRAFT_CLOSE
} from "@/modules/agent/refine";
import type { TaskRecord } from "@/modules/tasks/service";

describe("parseGeminiOutput", () => {
  it("returns reply only when no proposal markers", () => {
    expect(parseGeminiOutput("Hola, suena bien.")).toEqual({
      reply: "Hola, suena bien.",
      proposal: null
    });
  });

  it("splits reply + proposal when markers present", () => {
    const raw = "Añado pagos.\n<PROPUESTA>\nNuevo body con pagos.\n</PROPUESTA>";
    expect(parseGeminiOutput(raw)).toEqual({
      reply: "Añado pagos.",
      proposal: "Nuevo body con pagos."
    });
  });

  it("treats unterminated proposal as reply only", () => {
    const raw = "x\n<PROPUESTA>\nqueda sin cerrar";
    expect(parseGeminiOutput(raw).proposal).toBeNull();
  });
});

describe("draft comment helpers", () => {
  it("wraps and extracts a draft roundtrip", () => {
    const w = wrapDraft("spec v2");
    expect(w).toContain(DRAFT_OPEN);
    expect(w).toContain(DRAFT_CLOSE);
    expect(extractLatestDraft([{ body: w }])).toBe("spec v2");
  });

  it("extracts the most recent draft when multiple exist", () => {
    const comments = [
      { body: wrapDraft("first draft") },
      { body: "nothing here" },
      { body: wrapDraft("latest draft") }
    ];
    expect(extractLatestDraft(comments)).toBe("latest draft");
  });

  it("returns null when there is no draft", () => {
    expect(extractLatestDraft([{ body: "plain" }])).toBeNull();
    expect(extractLatestDraft([])).toBeNull();
  });
});

function buildCtx(overrides: {
  task?: TaskRecord | null;
  comments?: Array<{ author: string; body: string; createdAt: string }>;
  geminiReply?: string;
} = {}) {
  const sent: Array<{ text: string }> = [];
  const addedComments: string[] = [];
  const bodies: string[] = [];
  const task: TaskRecord | null =
    overrides.task === undefined
      ? {
          id: 5,
          title: "CRM para dentistas",
          body: "idea inicial",
          state: "PENDING_APPROVAL",
          priority: "normal",
          project: null,
          labels: [],
          htmlUrl: "u",
          updatedAt: ""
        }
      : overrides.task;
  return {
    sent,
    addedComments,
    bodies,
    ctx: {
      chatId: 1,
      userId: 1,
      ownerLogin: "jagsodo",
      telegram: {
        sendMessage: vi.fn(async (opts: { chatId: number; text: string }) => {
          sent.push({ text: opts.text });
        }),
        answerCallbackQuery: vi.fn(async () => {}),
        setWebhook: vi.fn(async () => ({}))
      },
      tasks: {
        getTask: vi.fn(async () => task),
        listComments: vi.fn(async () => overrides.comments ?? []),
        addComment: vi.fn(async (_id: number, body: string) => {
          addedComments.push(body);
        }),
        updateBody: vi.fn(async (_id: number, body: string) => {
          bodies.push(body);
        }),
        createTask: vi.fn(),
        listOpenTasks: vi.fn(async () => []),
        setState: vi.fn(),
        findAgentPrForTask: vi.fn(),
        checksStatus: vi.fn(),
        squashMergePr: vi.fn()
      },
      dispatcher: { dispatch: vi.fn() },
      gemini: {
        generate: vi.fn(async () => ({
          text: overrides.geminiReply ?? "Suena bien.\n<PROPUESTA>\nspec refinada\n</PROPUESTA>",
          usage: { promptTokens: 0, outputTokens: 0, thoughtTokens: 0, totalTokens: 0 }
        }))
      }
    }
  };
}

describe("/discutir", () => {
  it("rejects when GEMINI is not configured", async () => {
    const { ctx, sent } = buildCtx();
    (ctx as unknown as { gemini: null }).gemini = null;
    await handleCommand(ctx as never, "/discutir 5 añade pagos");
    expect(sent.at(-1)?.text).toMatch(/GEMINI_API_KEY/i);
  });

  it("asks for message when only id provided", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "/discutir 5");
    expect(sent.at(-1)?.text).toMatch(/Uso: \/discutir/);
  });

  it("calls Gemini, stores draft in a comment, and tells user to /aceptar", async () => {
    const { ctx, sent, addedComments } = buildCtx();
    await handleCommand(ctx as never, "/discutir 5 añade pagos con mercadopago");
    expect(ctx.gemini.generate).toHaveBeenCalledTimes(1);
    expect(addedComments[0]).toContain(DRAFT_OPEN);
    expect(addedComments[0]).toContain("spec refinada");
    expect(sent.at(-1)?.text).toMatch(/\/aceptar 5/);
  });

  it("tells user there is no draft when model omitted the markers", async () => {
    const { ctx, sent, addedComments } = buildCtx({ geminiReply: "Es solo una pregunta aclaratoria." });
    await handleCommand(ctx as never, "/discutir 5 que opinas?");
    expect(addedComments[0]).not.toContain(DRAFT_OPEN);
    expect(sent.at(-1)?.text).toMatch(/Sin propuesta/);
  });
});

describe("/aceptar", () => {
  it("rejects when there is no pending draft", async () => {
    const { ctx, sent } = buildCtx({ comments: [{ author: "u", body: "no drafts", createdAt: "" }] });
    await handleCommand(ctx as never, "/aceptar 5");
    expect(sent.at(-1)?.text).toMatch(/No hay propuesta/);
  });

  it("promotes the latest draft to the issue body", async () => {
    const { ctx, sent, bodies } = buildCtx({
      comments: [
        { author: "github-actions[bot]", body: wrapDraft("spec actualizada v2"), createdAt: "" }
      ]
    });
    await handleCommand(ctx as never, "/aceptar 5");
    expect(bodies).toEqual(["spec actualizada v2"]);
    expect(sent.at(-1)?.text).toMatch(/actualizado/i);
  });
});

describe("/ver", () => {
  it("prints the current body", async () => {
    const { ctx, sent } = buildCtx();
    await handleCommand(ctx as never, "/ver 5");
    expect(sent.at(-1)?.text).toContain("CRM para dentistas");
    expect(sent.at(-1)?.text).toContain("PENDING_APPROVAL");
  });

  it("warns when task doesn't exist", async () => {
    const { ctx, sent } = buildCtx({ task: null });
    await handleCommand(ctx as never, "/ver 999");
    expect(sent.at(-1)?.text).toMatch(/no existe/i);
  });
});
