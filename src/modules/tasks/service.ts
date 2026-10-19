import type { Octokit } from "@octokit/rest";
import { stateFromLabels, stateLabel, type TaskState } from "@/modules/tasks/states";

export interface TaskRecord {
  id: number;
  title: string;
  body: string;
  state: TaskState;
  priority: "low" | "normal" | "high";
  project: string | null;
  labels: string[];
  htmlUrl: string;
  updatedAt: string;
}

const TASK_LABEL = "ai-portfolio-factory";
const PRIORITY_RE = /^priority:(low|normal|high)$/i;
const PROJECT_RE = /^project:(.+)$/i;

export interface TaskServiceDeps {
  octokit: Octokit;
  owner: string;
  repo: string;
}

export function priorityFromLabels(labels: readonly string[]): TaskRecord["priority"] {
  for (const l of labels) {
    const m = PRIORITY_RE.exec(l);
    if (m && m[1]) return m[1].toLowerCase() as TaskRecord["priority"];
  }
  return "normal";
}

export function projectFromLabels(labels: readonly string[]): string | null {
  for (const l of labels) {
    const m = PROJECT_RE.exec(l);
    if (m && m[1]) return m[1];
  }
  return null;
}

function toRecord(issue: {
  number: number;
  title: string;
  body?: string | null;
  labels: Array<string | { name?: string }>;
  html_url: string;
  updated_at: string;
}): TaskRecord {
  const labelNames = issue.labels
    .map((l) => (typeof l === "string" ? l : l.name ?? ""))
    .filter(Boolean);
  return {
    id: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    state: stateFromLabels(labelNames),
    priority: priorityFromLabels(labelNames),
    project: projectFromLabels(labelNames),
    labels: labelNames,
    htmlUrl: issue.html_url,
    updatedAt: issue.updated_at
  };
}

export class TaskService {
  constructor(private readonly deps: TaskServiceDeps) {}

  async createTask(input: {
    title: string;
    body: string;
    project?: string;
    state?: TaskState;
    priority?: TaskRecord["priority"];
  }): Promise<TaskRecord> {
    const state = input.state ?? "PENDING_APPROVAL";
    const priority = input.priority ?? "normal";
    const labels = [TASK_LABEL, stateLabel(state), `priority:${priority}`];
    if (input.project) labels.push(`project:${input.project}`);
    const res = await this.deps.octokit.issues.create({
      owner: this.deps.owner,
      repo: this.deps.repo,
      title: input.title.slice(0, 180),
      body: input.body.slice(0, 60_000),
      labels
    });
    return toRecord(res.data);
  }

  async getTask(id: number): Promise<TaskRecord | null> {
    try {
      const res = await this.deps.octokit.issues.get({
        owner: this.deps.owner,
        repo: this.deps.repo,
        issue_number: id
      });
      return toRecord(res.data);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 404) return null;
      throw err;
    }
  }

  async listOpenTasks(opts: { state?: TaskState } = {}): Promise<TaskRecord[]> {
    const labels = [TASK_LABEL];
    if (opts.state) labels.push(stateLabel(opts.state));
    const res = await this.deps.octokit.issues.listForRepo({
      owner: this.deps.owner,
      repo: this.deps.repo,
      state: "open",
      labels: labels.join(","),
      per_page: 50
    });
    return res.data
      .filter((i) => !("pull_request" in i) || !i.pull_request)
      .map((i) => toRecord(i));
  }

  async setState(id: number, next: TaskState, note?: string): Promise<TaskRecord> {
    const current = await this.getTask(id);
    if (!current) throw new Error(`Task #${id} not found`);
    const nextLabels = current.labels
      .filter((l) => !l.toLowerCase().startsWith("state:"))
      .concat(stateLabel(next));
    await this.deps.octokit.issues.update({
      owner: this.deps.owner,
      repo: this.deps.repo,
      issue_number: id,
      labels: nextLabels
    });
    if (note) {
      await this.deps.octokit.issues.createComment({
        owner: this.deps.owner,
        repo: this.deps.repo,
        issue_number: id,
        body: `State transition **${current.state} → ${next}**\n\n${note}`
      });
    }
    return { ...current, state: next, labels: nextLabels };
  }

  async addComment(id: number, body: string): Promise<void> {
    await this.deps.octokit.issues.createComment({
      owner: this.deps.owner,
      repo: this.deps.repo,
      issue_number: id,
      body: body.slice(0, 60_000)
    });
  }

  /**
   * Finds the newest open PR whose head branch matches `agent/task-<id>-*`.
   * Returns null when there is no such PR.
   */
  async findAgentPrForTask(id: number): Promise<{
    number: number;
    htmlUrl: string;
    headSha: string;
    headBranch: string;
    state: "open" | "closed";
    merged: boolean;
  } | null> {
    const prefix = `agent/task-${id}-`;
    const res = await this.deps.octokit.pulls.list({
      owner: this.deps.owner,
      repo: this.deps.repo,
      state: "open",
      per_page: 50,
      sort: "created",
      direction: "desc"
    });
    const match = res.data.find((p) => p.head.ref.startsWith(prefix));
    if (!match) return null;
    return {
      number: match.number,
      htmlUrl: match.html_url,
      headSha: match.head.sha,
      headBranch: match.head.ref,
      state: match.state as "open" | "closed",
      merged: Boolean(match.merged_at)
    };
  }

  /** Returns the combined CI status for a commit: success/pending/failure/none. */
  async checksStatus(sha: string): Promise<"success" | "pending" | "failure" | "none"> {
    const res = await this.deps.octokit.checks.listForRef({
      owner: this.deps.owner,
      repo: this.deps.repo,
      ref: sha,
      per_page: 100
    });
    const runs = res.data.check_runs;
    if (!runs.length) return "none";
    if (runs.some((r) => r.status !== "completed")) return "pending";
    if (runs.some((r) => r.conclusion && !["success", "neutral", "skipped"].includes(r.conclusion))) {
      return "failure";
    }
    return "success";
  }

  async squashMergePr(prNumber: number, commitTitle: string, commitMessage: string): Promise<void> {
    await this.deps.octokit.pulls.merge({
      owner: this.deps.owner,
      repo: this.deps.repo,
      pull_number: prNumber,
      merge_method: "squash",
      commit_title: commitTitle.slice(0, 72),
      commit_message: commitMessage.slice(0, 2000)
    });
  }
}
