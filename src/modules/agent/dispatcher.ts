import type { Octokit } from "@octokit/rest";

export interface DispatchInput {
  taskId: number;
  reason: string;
}

export interface AgentDispatcherDeps {
  octokit: Octokit;
  owner: string;
  repo: string;
  workflowFile?: string;
  ref?: string;
}

/**
 * Triggers the Claude Code workflow via workflow_dispatch. We do not block the
 * Telegram webhook on this; callers should await it only when the HTTP
 * response can afford the extra round-trip (typically <500ms).
 */
export class AgentDispatcher {
  constructor(private readonly deps: AgentDispatcherDeps) {}

  async dispatch(input: DispatchInput): Promise<void> {
    await this.deps.octokit.actions.createWorkflowDispatch({
      owner: this.deps.owner,
      repo: this.deps.repo,
      workflow_id: this.deps.workflowFile ?? "agent.yml",
      ref: this.deps.ref ?? "main",
      inputs: {
        task_id: String(input.taskId),
        reason: input.reason.slice(0, 200)
      }
    });
  }
}
