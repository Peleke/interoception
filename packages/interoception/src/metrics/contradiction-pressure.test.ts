import { describe, it, expect } from "vitest";
import { computeContradictionPressure } from "./contradiction-pressure.js";

describe("computeContradictionPressure", () => {
  it("returns 0 for empty array", () => {
    expect(computeContradictionPressure([])).toBe(0);
  });

  it("returns 0 for single embedding", () => {
    expect(computeContradictionPressure([[1, 0]])).toBe(0);
  });

  it("returns 0 for identical embeddings", () => {
    expect(computeContradictionPressure([[1, 0], [1, 0]])).toBe(0);
  });

  it("returns 1 for orthogonal embeddings (low sim pairs)", () => {
    const embeddings = [[1, 0], [0, 1]];
    // cosine sim = 0, which is < 0.3 threshold
    expect(computeContradictionPressure(embeddings)).toBe(1);
  });

  it("returns 0 for highly similar embeddings", () => {
    const embeddings = [[1, 0.1], [1, 0.2]];
    // Very similar vectors, sim >> 0.3
    expect(computeContradictionPressure(embeddings)).toBe(0);
  });

  it("returns partial value for mixed pairs", () => {
    const embeddings = [
      [1, 0],    // similar to each other
      [0.9, 0.1],
      [0, 1],    // contradicts first two
    ];
    const pressure = computeContradictionPressure(embeddings);
    expect(pressure).toBeGreaterThan(0);
    expect(pressure).toBeLessThan(1);
  });

  it("is permutation invariant", () => {
    const a = [1, 0];
    const b = [0.5, 0.5];
    const c = [0, 1];
    expect(computeContradictionPressure([a, b, c])).toBe(
      computeContradictionPressure([c, a, b]),
    );
    expect(computeContradictionPressure([a, b, c])).toBe(
      computeContradictionPressure([b, c, a]),
    );
  });

  it("respects custom threshold", () => {
    const embeddings = [[1, 0], [0.8, 0.6]];
    // Sim ≈ 0.8, low threshold passes, high threshold fails
    expect(computeContradictionPressure(embeddings, 0.1)).toBe(0);
    expect(computeContradictionPressure(embeddings, 0.9)).toBe(1);
  });
});
