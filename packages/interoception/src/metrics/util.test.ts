import { describe, it, expect } from "vitest";
import { dot, magnitude, normalize, cosineSimilarity, clamp01, mean } from "./util.js";

describe("dot", () => {
  it("computes dot product", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(dot([1, 0], [0, 1])).toBe(0);
  });
});

describe("magnitude", () => {
  it("computes L2 norm", () => {
    expect(magnitude([3, 4])).toBe(5);
  });

  it("returns 0 for zero vector", () => {
    expect(magnitude([0, 0, 0])).toBe(0);
  });
});

describe("normalize", () => {
  it("returns unit vector", () => {
    const result = normalize([3, 4]);
    expect(result[0]).toBeCloseTo(0.6);
    expect(result[1]).toBeCloseTo(0.8);
    expect(magnitude(result)).toBeCloseTo(1);
  });

  it("returns zero vector for zero input", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 1 for parallel vectors", () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 when either vector is zero", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });
});

describe("clamp01", () => {
  it("clamps below 0", () => {
    expect(clamp01(-0.5)).toBe(0);
  });

  it("clamps above 1", () => {
    expect(clamp01(1.5)).toBe(1);
  });

  it("passes through values in range", () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("mean", () => {
  it("computes mean", () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });
});
