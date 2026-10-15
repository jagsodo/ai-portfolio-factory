import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  stateFromLabels,
  stateLabel,
  TASK_STATES
} from "@/modules/tasks/states";

describe("state machine", () => {
  it("allows PENDING_APPROVAL -> APPROVED", () => {
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
  });

  it("forbids IDEA -> PUBLISHED directly", () => {
    expect(canTransition("IDEA", "PUBLISHED")).toBe(false);
    expect(() => assertTransition("IDEA", "PUBLISHED")).toThrow();
  });

  it("PUBLISHED is terminal", () => {
    for (const s of TASK_STATES) {
      expect(canTransition("PUBLISHED", s)).toBe(false);
    }
  });

  it("stateFromLabels parses state label", () => {
    expect(stateFromLabels(["ai-portfolio-factory", "state:APPROVED"])).toBe("APPROVED");
    expect(stateFromLabels(["random"])).toBe("IDEA");
  });

  it("stateLabel round-trips", () => {
    expect(stateLabel("QUEUED")).toBe("state:QUEUED");
  });
});
