import type { TaskService } from "@/modules/tasks/service";
import type { AgentDispatcher } from "@/modules/agent/dispatcher";
import type { TelegramApi, InlineKeyboardButton } from "@/lib/telegram/client";
import type { TaskRecord } from "@/modules/tasks/service";
import type { GeminiClient } from "@/lib/gemini/client";
import {
  refineTaskSpec,
  wrapDraft,
  extractLatestDraft
} from "@/modules/agent/refine";

export interface CommandContext {
  chatId: number;
  userId: number;
  tasks: TaskService;
  dispatcher: AgentDispatcher;
  telegram: TelegramApi;
  /** Optional: when present, enables /discutir and /aceptar. */
  gemini?: GeminiClient | null;
  /** GitHub login used as "owner" in the refinement thread. Falls back to "owner". */
  ownerLogin?: string;
}

export interface ParsedCommand {
  command: string;
  args: string;
}

const COMMAND_RE = /^\/([a-z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i;
const MAX_ARG_LEN = 2000;

export function parseCommand(text: string): ParsedCommand | null {
  if (text.length > 4096) return null;
  const trimmed = text.trim();
  const m = COMMAND_RE.exec(trimmed);
  if (!m) return null;
  const command = (m[1] ?? "").toLowerCase();
  // Strip control characters that could interfere with Issue bodies/labels.
  // Keep newlines and tabs.
  const raw = (m[2] ?? "").trim();
  // eslint-disable-next-line no-control-regex
  const args = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, MAX_ARG_LEN);
  if (!command) return null;
  return { command, args };
}

export function helpText(): string {
  return [
    "AI Portfolio Factory — comandos disponibles:",
    "",
    "/start — Presentación y estado",
    "/help — Esta ayuda",
    "/ideas — Pedir propuestas de proyecto",
    "/nuevo <descripción> — Registrar una idea de software",
    "/ver <id> — Ver el estado y descripción de una tarea",
    "/discutir <id> <mensaje> — Refinar la spec de la tarea con el asistente",
    "/aceptar <id> — Aplicar la última propuesta al cuerpo del issue",
    "/proyectos — Listar proyectos registrados",
    "/estado — Ver tareas en curso",
    "/pendientes — Tareas que requieren intervención",
    "/reporte — Resumen del último trabajo",
    "/iniciar <id> — Iniciar tarea aprobada",
    "/aprobar <id> — Aprobar una propuesta",
    "/rechazar <id> — Rechazar una propuesta",
    "/prioridad <id> <low|normal|high> — Cambiar prioridad",
    "/pausar — Pausar la asignación de tareas",
    "/reanudar — Reactivar la asignación",
    "/publicar <id> — Mergear el PR del agente tras CI verde"
  ].join("\n");
}

export function startText(): string {
  return [
    "AI Portfolio Factory listo.",
    "Soy el controlador del agente autónomo. Puedo registrar ideas,",
    "coordinar tareas en GitHub y lanzar ejecuciones de Claude Code.",
    "",
    "Escribe /help para ver los comandos."
  ].join("\n");
}

function approvalKeyboard(taskId: number): InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ Aprobar", callback_data: `approve:${taskId}` },
      { text: "❌ Rechazar", callback_data: `reject:${taskId}` }
    ],
    [{ text: "ℹ️ Ver estado", callback_data: `status:${taskId}` }]
  ];
}

function formatTaskLine(t: TaskRecord): string {
  const proj = t.project ? ` [${t.project}]` : "";
  return `• #${t.id}${proj} ${t.title} — ${t.state} (prio ${t.priority})`;
}

async function cmdNuevo(ctx: CommandContext, args: string): Promise<void> {
  if (!args) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Uso: /nuevo <descripción de la idea>"
    });
    return;
  }
  const title = args.split("\n")[0]?.slice(0, 120) ?? "Nueva idea";
  const task = await ctx.tasks.createTask({
    title,
    body: [
      "## Descripción",
      args,
      "",
      "## Origen",
      "Registrada desde Telegram."
    ].join("\n"),
    state: "PENDING_APPROVAL"
  });
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text:
      `Idea registrada como #${task.id}.\n` +
      `Estado: PENDING_APPROVAL.\n${task.htmlUrl}`,
    inlineKeyboard: approvalKeyboard(task.id)
  });
}

async function cmdIdeas(ctx: CommandContext): Promise<void> {
  const prompt = [
    "Para generar propuestas usa /nuevo <idea>.",
    "La generación automática la realiza Claude en el workflow dedicado;",
    "este controlador no gasta tokens en el webhook."
  ].join("\n");
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: prompt });
}

async function cmdProyectos(ctx: CommandContext): Promise<void> {
  const tasks = await ctx.tasks.listOpenTasks();
  const projects = new Set<string>();
  for (const t of tasks) if (t.project) projects.add(t.project);
  const text = projects.size
    ? `Proyectos activos:\n${[...projects].map((p) => `• ${p}`).join("\n")}`
    : "Sin proyectos registrados todavía.";
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text });
}

async function cmdEstado(ctx: CommandContext): Promise<void> {
  const tasks = await ctx.tasks.listOpenTasks();
  const text = tasks.length
    ? `Tareas abiertas (${tasks.length}):\n${tasks.map(formatTaskLine).join("\n")}`
    : "No hay tareas abiertas.";
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text });
}

async function cmdPendientes(ctx: CommandContext): Promise<void> {
  const all = await ctx.tasks.listOpenTasks();
  const pend = all.filter(
    (t) => t.state === "PENDING_APPROVAL" || t.state === "BLOCKED" || t.state === "IN_REVIEW"
  );
  const text = pend.length
    ? `Pendientes:\n${pend.map(formatTaskLine).join("\n")}`
    : "Nada pendiente.";
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text });
}

async function cmdReporte(ctx: CommandContext): Promise<void> {
  const tasks = await ctx.tasks.listOpenTasks();
  const recent = tasks
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const text = recent.length
    ? `Últimas actualizaciones:\n${recent.map(formatTaskLine).join("\n")}`
    : "Sin actividad reciente.";
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text });
}

async function cmdIniciar(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  if (!Number.isInteger(id) || id <= 0) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Uso: /iniciar <id>"
    });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  if (task.state !== "APPROVED" && task.state !== "QUEUED" && task.state !== "FAILED") {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `Tarea #${id} está en ${task.state}; apruébala primero con /aprobar ${id}.`
    });
    return;
  }
  await ctx.tasks.setState(id, "QUEUED", "Encolada manualmente desde Telegram.");
  await ctx.dispatcher.dispatch({ taskId: id, reason: "manual-start" });
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `Tarea #${id} encolada. Workflow disparado.\n${task.htmlUrl}`
  });
}

async function cmdAprobar(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  if (!Number.isInteger(id) || id <= 0) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: "Uso: /aprobar <id>" });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  if (task.state !== "PENDING_APPROVAL" && task.state !== "IN_REVIEW") {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `No puedo aprobar desde el estado ${task.state}.`
    });
    return;
  }
  const next = task.state === "IN_REVIEW" ? "COMPLETED" : "APPROVED";
  await ctx.tasks.setState(id, next, `Aprobada por el propietario (Telegram user ${ctx.userId}).`);
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `Tarea #${id} → ${next}. ${task.htmlUrl}`
  });
}

async function cmdRechazar(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  if (!Number.isInteger(id) || id <= 0) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: "Uso: /rechazar <id>" });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  await ctx.tasks.setState(id, "FAILED", `Rechazada por el propietario (Telegram user ${ctx.userId}).`);
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} marcada como FAILED.` });
}

async function cmdPrioridad(ctx: CommandContext, args: string): Promise<void> {
  const [idPart, level] = args.split(/\s+/);
  const id = Number(idPart);
  if (!Number.isInteger(id) || !level || !/^(low|normal|high)$/i.test(level)) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Uso: /prioridad <id> <low|normal|high>"
    });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  const nextLabels = task.labels
    .filter((l) => !l.toLowerCase().startsWith("priority:"))
    .concat(`priority:${level.toLowerCase()}`);
  await ctx.tasks.addComment(id, `Prioridad actualizada a **${level.toLowerCase()}**.`);
  // Reuse setState to update labels in a single call isn't quite right; use raw update:
  await ctx.tasks["deps"].octokit.issues.update({
    owner: ctx.tasks["deps"].owner,
    repo: ctx.tasks["deps"].repo,
    issue_number: id,
    labels: nextLabels
  });
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `Tarea #${id} con prioridad ${level.toLowerCase()}.`
  });
}

async function cmdPausar(ctx: CommandContext): Promise<void> {
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text:
      "Pausa registrada. Añade la etiqueta `agent:paused` al repositorio para que el workflow diario respete la pausa (ver OPERATIONS.md).\n" +
      "Las ejecuciones en curso en GitHub Actions no se cancelan automáticamente; usa el link de la ejecución si necesitas abortarla."
  });
}

async function cmdReanudar(ctx: CommandContext): Promise<void> {
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: "Reanudación anotada. Retira la etiqueta `agent:paused` del repositorio para habilitar el daily run."
  });
}

async function cmdPublicar(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  const task = Number.isInteger(id) ? await ctx.tasks.getTask(id) : null;
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: "Uso: /publicar <id>" });
    return;
  }

  const pr = await ctx.tasks.findAgentPrForTask(id);
  if (!pr) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `No encuentro un Pull Request abierto para la tarea #${id}.`
    });
    return;
  }

  const status = await ctx.tasks.checksStatus(pr.headSha);
  if (status === "pending") {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `CI del PR #${pr.number} aún corriendo. Reintenta /publicar ${id} en un minuto.\n${pr.htmlUrl}`
    });
    return;
  }
  if (status === "failure") {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text:
        `No puedo publicar: el CI del PR #${pr.number} está en failure. Revisa la ejecución antes de reintentar.\n${pr.htmlUrl}`
    });
    return;
  }

  await ctx.tasks.addComment(
    id,
    `Publicación aprobada por el propietario (Telegram user ${ctx.userId}). Mergeando PR #${pr.number} con squash.`
  );

  try {
    await ctx.tasks.squashMergePr(
      pr.number,
      `agent(task-${id}): ${task.title}`.slice(0, 72),
      `Approved and merged via Telegram by owner.\n\nTask: #${id}\nPR: #${pr.number}`
    );
  } catch (err) {
    const msg = (err as Error).message;
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text:
        `No pude mergear el PR #${pr.number} automáticamente: ${msg}\n` +
        `Puedes mergearlo tú en: ${pr.htmlUrl}`
    });
    return;
  }

  await ctx.tasks.setState(id, "PUBLISHED", `Mergeado automáticamente tras /publicar desde Telegram.`);
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `Publicado ✅ PR #${pr.number} mergeado. Tarea #${id} → PUBLISHED.\n${pr.htmlUrl}`
  });
}

async function cmdVer(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  if (!Number.isInteger(id) || id <= 0) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: "Uso: /ver <id>" });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  const body = task.body.trim() ? task.body : "(sin descripción)";
  const txt = [
    `#${task.id} — ${task.title}`,
    `Estado: ${task.state} · prioridad ${task.priority}`,
    task.project ? `Proyecto: ${task.project}` : null,
    "",
    body.slice(0, 3500),
    "",
    task.htmlUrl
  ]
    .filter(Boolean)
    .join("\n");
  await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: txt });
}

async function cmdDiscutir(ctx: CommandContext, args: string): Promise<void> {
  if (!ctx.gemini) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "El asistente de refinamiento no está configurado (falta GEMINI_API_KEY)."
    });
    return;
  }
  const sep = args.search(/\s/);
  const idPart = sep === -1 ? args : args.slice(0, sep);
  const message = sep === -1 ? "" : args.slice(sep + 1).trim();
  const id = Number(idPart);
  if (!Number.isInteger(id) || id <= 0 || !message) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: "Uso: /discutir <id> <mensaje o pregunta>"
    });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  const result = await refineTaskSpec({
    gemini: ctx.gemini,
    tasks: ctx.tasks,
    task,
    ownerLogin: ctx.ownerLogin ?? "owner",
    userMessage: message
  });

  // Persist the owner's message + the model's reply + an optional draft.
  const commentParts = [
    `**/discutir** (owner): ${message}`,
    "",
    `**Gemini:** ${result.reply || "(sin respuesta)"}`
  ];
  if (result.proposalBody) commentParts.push("", wrapDraft(result.proposalBody));
  await ctx.tasks.addComment(id, commentParts.join("\n"));

  const telegramParts = [
    result.reply || "(respuesta vacía)",
    "",
    result.proposalBody
      ? `Propuesta guardada. Ejecuta /aceptar ${id} para aplicarla, o /discutir ${id} <más indicaciones>.`
      : `Sin propuesta de cambio. Vuelve a /discutir ${id} <más indicaciones>.`
  ];
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: telegramParts.join("\n")
  });
}

async function cmdAceptar(ctx: CommandContext, args: string): Promise<void> {
  const id = Number(args.trim());
  if (!Number.isInteger(id) || id <= 0) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: "Uso: /aceptar <id>" });
    return;
  }
  const task = await ctx.tasks.getTask(id);
  if (!task) {
    await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: `Tarea #${id} no existe.` });
    return;
  }
  const comments = await ctx.tasks.listComments(id, 20);
  const draft = extractLatestDraft(comments);
  if (!draft) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text: `No hay propuesta pendiente en #${id}. Usa /discutir ${id} <...> primero.`
    });
    return;
  }
  await ctx.tasks.updateBody(id, draft);
  await ctx.tasks.addComment(
    id,
    `Propietario aceptó la última propuesta como nuevo spec del issue.`
  );
  await ctx.telegram.sendMessage({
    chatId: ctx.chatId,
    text: `Spec actualizado en #${id}. Puedes /aprobar ${id} y luego /iniciar ${id} cuando esté listo.`
  });
}

export async function handleCommand(ctx: CommandContext, text: string): Promise<void> {
  const parsed = parseCommand(text);
  if (!parsed) {
    await ctx.telegram.sendMessage({
      chatId: ctx.chatId,
      text:
        "Recibido. Para registrar una idea usa `/nuevo <descripción>`.\n" +
        "Las consultas en lenguaje natural se delegarán a Claude cuando se despliegue la Fase 2."
    });
    return;
  }
  switch (parsed.command) {
    case "start":
      await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: startText() });
      return;
    case "help":
      await ctx.telegram.sendMessage({ chatId: ctx.chatId, text: helpText() });
      return;
    case "nuevo":
      await cmdNuevo(ctx, parsed.args);
      return;
    case "ver":
      await cmdVer(ctx, parsed.args);
      return;
    case "discutir":
      await cmdDiscutir(ctx, parsed.args);
      return;
    case "aceptar":
      await cmdAceptar(ctx, parsed.args);
      return;
    case "ideas":
      await cmdIdeas(ctx);
      return;
    case "proyectos":
      await cmdProyectos(ctx);
      return;
    case "estado":
      await cmdEstado(ctx);
      return;
    case "pendientes":
      await cmdPendientes(ctx);
      return;
    case "reporte":
      await cmdReporte(ctx);
      return;
    case "iniciar":
      await cmdIniciar(ctx, parsed.args);
      return;
    case "aprobar":
      await cmdAprobar(ctx, parsed.args);
      return;
    case "rechazar":
      await cmdRechazar(ctx, parsed.args);
      return;
    case "prioridad":
      await cmdPrioridad(ctx, parsed.args);
      return;
    case "pausar":
      await cmdPausar(ctx);
      return;
    case "reanudar":
      await cmdReanudar(ctx);
      return;
    case "publicar":
      await cmdPublicar(ctx, parsed.args);
      return;
    default:
      await ctx.telegram.sendMessage({
        chatId: ctx.chatId,
        text: `Comando no reconocido: /${parsed.command}. Usa /help.`
      });
  }
}

export async function handleCallback(
  ctx: CommandContext,
  data: string,
  callbackQueryId: string
): Promise<void> {
  const [action, idRaw] = data.split(":");
  const id = Number(idRaw);
  if (!action || !Number.isInteger(id)) {
    await ctx.telegram.answerCallbackQuery(callbackQueryId, "Callback inválido.");
    return;
  }
  switch (action) {
    case "approve":
      await cmdAprobar(ctx, String(id));
      break;
    case "reject":
      await cmdRechazar(ctx, String(id));
      break;
    case "status": {
      const task = await ctx.tasks.getTask(id);
      await ctx.telegram.sendMessage({
        chatId: ctx.chatId,
        text: task
          ? `#${task.id} ${task.title}\nEstado: ${task.state}\n${task.htmlUrl}`
          : `Tarea #${id} no existe.`
      });
      break;
    }
    default:
      await ctx.telegram.answerCallbackQuery(callbackQueryId, "Acción desconocida.");
      return;
  }
  await ctx.telegram.answerCallbackQuery(callbackQueryId, "OK");
}
