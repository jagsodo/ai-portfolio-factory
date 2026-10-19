/**
 * /discutir — conversational spec refinement via Gemini.
 *
 * The GitHub Issue is the single source of truth: its body is the current
 * spec, and the thread of refinement comments is the full history. Each
 * `/discutir <id> <message>` call sends:
 *   system  = refinement persona + output contract
 *   history = previous "user:" / "gemini:" turns extracted from issue comments
 *   message = the new user instruction
 *
 * Gemini is asked to answer in Spanish with a short natural reply AND an
 * optional updated spec between <PROPUESTA> ... </PROPUESTA> markers. We
 * persist the proposal as a specially-tagged issue comment so `/aceptar`
 * can promote it to the issue body later.
 */
import type { GeminiClient, GeminiMessage } from "@/lib/gemini/client";
import type { TaskService, TaskRecord } from "@/modules/tasks/service";

export const DRAFT_OPEN = "<!-- apf:draft -->";
export const DRAFT_CLOSE = "<!-- /apf:draft -->";
export const PROPOSAL_OPEN = "<PROPUESTA>";
export const PROPOSAL_CLOSE = "</PROPUESTA>";

const SYSTEM_INSTRUCTION = [
  "Eres el asistente de refinamiento de specs del proyecto AI Portfolio Factory.",
  "Trabajas con el propietario (único usuario autorizado) para pulir la descripción de una tarea de desarrollo",
  "antes de que un agente autónomo (Claude Code) la implemente.",
  "",
  "Reglas:",
  "- Responde SIEMPRE en español.",
  "- Sé conciso: 2-4 frases para la respuesta conversacional.",
  "- Haz preguntas aclaratorias solo si son imprescindibles.",
  "- No inventes datos de negocio, usuarios ni métricas de mercado.",
  "- Prefiere entregables concretos, acotados, verificables.",
  "",
  "Formato de salida obligatorio:",
  "1) Primero: tu respuesta natural (lo que ve el propietario en Telegram).",
  "2) Si propones un nuevo cuerpo para el issue, inclúyelo entre marcadores:",
  `${PROPOSAL_OPEN}`,
  "<versión completa del body que iría al issue si acepta>",
  `${PROPOSAL_CLOSE}`,
  "3) Si solo contestas una pregunta y no toca cambiar el body, omite los marcadores."
].join("\n");

export interface RefineResult {
  reply: string;
  proposalBody: string | null;
  usage: {
    promptTokens: number;
    outputTokens: number;
    thoughtTokens: number;
    totalTokens: number;
  };
}

export function parseGeminiOutput(raw: string): { reply: string; proposal: string | null } {
  const openIdx = raw.indexOf(PROPOSAL_OPEN);
  if (openIdx === -1) return { reply: raw.trim(), proposal: null };
  const closeIdx = raw.indexOf(PROPOSAL_CLOSE, openIdx);
  if (closeIdx === -1) {
    // Unterminated proposal: show everything to the user, don't persist draft.
    return { reply: raw.trim(), proposal: null };
  }
  const reply = raw.slice(0, openIdx).trim();
  const proposal = raw.slice(openIdx + PROPOSAL_OPEN.length, closeIdx).trim();
  return { reply, proposal: proposal || null };
}

/** Builds the Gemini contents array from the issue history. */
export function buildHistory(
  task: Pick<TaskRecord, "title" | "body">,
  comments: ReadonlyArray<{ author: string; body: string }>,
  ownerLogin: string
): { seed: string; messages: GeminiMessage[] } {
  const seed = [
    `Título actual: ${task.title}`,
    "",
    "Cuerpo actual (spec):",
    task.body || "(vacío)"
  ].join("\n");

  const msgs: GeminiMessage[] = [];
  for (const c of comments) {
    const isOwner = c.author === ownerLogin;
    // Transition / status comments made by the owner from Telegram are noise.
    if (/^state transition/i.test(c.body)) continue;
    // Reports from the agent run are noise.
    if (/^## agent run report/i.test(c.body)) continue;
    // Previous drafts: fold them into the model turn.
    const text = c.body.trim();
    if (!text) continue;
    msgs.push({ role: isOwner ? "user" : "model", text });
  }
  return { seed, messages: msgs };
}

export async function refineTaskSpec(deps: {
  gemini: GeminiClient;
  tasks: TaskService;
  task: TaskRecord;
  ownerLogin: string;
  userMessage: string;
}): Promise<RefineResult> {
  const comments = await deps.tasks.listComments(deps.task.id, 20);
  const { seed, messages } = buildHistory(deps.task, comments, deps.ownerLogin);
  const fullMessages: GeminiMessage[] = [
    { role: "user", text: seed },
    ...messages,
    { role: "user", text: deps.userMessage }
  ];
  const res = await deps.gemini.generate({
    system: SYSTEM_INSTRUCTION,
    messages: fullMessages,
    maxOutputTokens: 2048
  });
  const parsed = parseGeminiOutput(res.text);
  return { reply: parsed.reply, proposalBody: parsed.proposal, usage: res.usage };
}

export function wrapDraft(proposal: string): string {
  return `${DRAFT_OPEN}\n${proposal}\n${DRAFT_CLOSE}`;
}

export function extractLatestDraft(
  comments: ReadonlyArray<{ body: string }>
): string | null {
  // Walk from most recent back; first comment with a draft wins.
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (!c) continue;
    const open = c.body.indexOf(DRAFT_OPEN);
    const close = c.body.indexOf(DRAFT_CLOSE, open);
    if (open !== -1 && close !== -1) {
      return c.body.slice(open + DRAFT_OPEN.length, close).trim() || null;
    }
  }
  return null;
}
