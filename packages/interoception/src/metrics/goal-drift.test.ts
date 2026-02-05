import { describe, it, expect } from "vitest";
import { computeGoalDrift } from "./goal-drift.js";

describe("computeGoalDrift", () => {
  it("returns 0 for empty goals", () => {
    expect(computeGoalDrift([], [[1, 0]])).toBe(0);
  });

  it("returns 0 for empty context", () => {
    expect(computeGoalDrift([[1, 0]], [])).toBe(0);
  });

  it("returns 0 when context is identical to goals", () => {
    const goals = [[1, 0, 0]];
    const context = [[1, 0, 0]];
    expect(computeGoalDrift(goals, context)).toBeCloseTo(0);
  });

  it("returns ~1 when context is orthogonal to goals", () => {
    const goals = [[1, 0]];
    const context = [[0, 1]];
    expect(computeGoalDrift(goals, context)).toBeCloseTo(1);
  });

  it("returns intermediate value for partially aligned context", () => {
    const goals = [[1, 0]];
    const context = [[0.7, 0.7]]; // ~45 degrees
    const drift = computeGoalDrift(goals, context);
    expect(drift).toBeGreaterThan(0);
    expect(drift).toBeLessThan(1);
  });

  it("handles multiple goals — context matches best goal", () => {
    const goals = [[1, 0], [0, 1]];
    const context = [[1, 0]]; // Perfect match with first goal
    expect(computeGoalDrift(goals, context)).toBeCloseTo(0);
  });
});
