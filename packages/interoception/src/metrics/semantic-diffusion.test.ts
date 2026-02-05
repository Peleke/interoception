import { describe, it, expect } from "vitest";
import { computeSemanticDiffusion } from "./semantic-diffusion.js";

describe("computeSemanticDiffusion", () => {
  it("returns 0 for empty array", () => {
    expect(computeSemanticDiffusion([])).toBe(0);
  });

  it("returns 0 for single embedding", () => {
    expect(computeSemanticDiffusion([[1, 0]])).toBe(0);
  });

  it("returns 0 for identical embeddings", () => {
    expect(computeSemanticDiffusion([[1, 0], [1, 0], [1, 0]])).toBeCloseTo(0);
  });

  it("returns ~1 for orthogonal embeddings", () => {
    expect(computeSemanticDiffusion([[1, 0], [0, 1]])).toBeCloseTo(1);
  });

  it("is permutation invariant", () => {
    const a = [1, 0];
    const b = [0.7, 0.7];
    const c = [0, 1];
    expect(computeSemanticDiffusion([a, b, c])).toBe(
      computeSemanticDiffusion([c, a, b]),
    );
    expect(computeSemanticDiffusion([a, b, c])).toBe(
      computeSemanticDiffusion([b, c, a]),
    );
  });

  it("returns intermediate value for partially spread embeddings", () => {
    const embeddings = [[1, 0], [0.7, 0.7], [1, 0.1]];
    const diffusion = computeSemanticDiffusion(embeddings);
    expect(diffusion).toBeGreaterThan(0);
    expect(diffusion).toBeLessThan(1);
  });
});
