import { describe, it, expect } from "vitest";
import { computeMemoryRetention } from "./memory-retention.js";

describe("computeMemoryRetention", () => {
  it("returns 0 for empty goals", () => {
    expect(computeMemoryRetention([], [[1, 0]])).toBe(0);
  });

  it("returns 0 for empty memories", () => {
    expect(computeMemoryRetention([[1, 0]], [])).toBe(0);
  });

  it("returns ~1 when memories perfectly cover goals", () => {
    const goals = [[1, 0], [0, 1]];
    const memories = [[1, 0], [0, 1]];
    expect(computeMemoryRetention(goals, memories)).toBeCloseTo(1);
  });

  it("returns low value when memories are irrelevant to goals", () => {
    const goals = [[1, 0]];
    const memories = [[0, 1]]; // Orthogonal
    expect(computeMemoryRetention(goals, memories)).toBeCloseTo(0);
  });

  it("handles partial retention", () => {
    const goals = [[1, 0], [0, 1]];
    const memories = [[1, 0]]; // Only covers first goal
    const retention = computeMemoryRetention(goals, memories);
    // First goal: sim ≈ 1, second goal: sim ≈ 0 → mean ≈ 0.5
    expect(retention).toBeCloseTo(0.5, 0);
  });
});
