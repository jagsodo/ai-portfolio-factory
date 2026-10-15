export const TASK_STATES = [
  "IDEA",
  "PENDING_APPROVAL",
  "APPROVED",
  "QUEUED",
  "RUNNING",
  "BLOCKED",
  "FAILED",
  "IN_REVIEW",
  "COMPLETED",
  "PUBLISHED",
  "PAUSED"
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  IDEA: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED", "FAILED", "PAUSED"],
  APPROVED: ["QUEUED", "PAUSED"],
  QUEUED: ["RUNNING", "PAUSED", "APPROVED"],
  RUNNING: ["IN_REVIEW", "FAILED", "BLOCKED", "COMPLETED", "PAUSED"],
  BLOCKED: ["QUEUED", "FAILED", "PAUSED"],
  FAILED: ["QUEUED", "PAUSED"],
  IN_REVIEW: ["COMPLETED", "FAILED", "PAUSED"],
  COMPLETED: ["PUBLISHED", "IN_REVIEW"],
  PUBLISHED: [],
  PAUSED: ["QUEUED", "APPROVED", "PENDING_APPROVAL", "FAILED"]
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TaskState, to: TaskState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}

export function stateFromLabels(labels: readonly string[]): TaskState {
  for (const l of labels) {
    const upper = l.toUpperCase().replace(/^STATE[:/]/, "");
    if ((TASK_STATES as readonly string[]).includes(upper)) {
      return upper as TaskState;
    }
  }
  return "IDEA";
}

export function stateLabel(state: TaskState): string {
  return `state:${state}`;
}
