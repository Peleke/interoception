import { describe, it, expect } from "vitest";
import { computeCoherenceIndex, classifyBand } from "./coherence-index.js";
import type { MetricSnapshot } from "../types.js";

/** Standard inverted set matching the core metrics' polarity declarations. */
const CORE_INVERTED = new Set(["goalDrift", "contradictionPressure", "semanticDiffusion"]);

describe("computeCoherenceIndex", () => {
  it("returns 1 for perfect coherence", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,
      memoryRetention: 1,
      contradictionPressure: 0,
      semanticDiffusion: 0,
    };
    expect(computeCoherenceIndex(metrics, undefined, CORE_INVERTED)).toBeCloseTo(1);
  });

  it("returns 0 for total incoherence", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 1,
      memoryRetention: 0,
      contradictionPressure: 1,
      semanticDiffusion: 1,
    };
    expect(computeCoherenceIndex(metrics, undefined, CORE_INVERTED)).toBeCloseTo(0);
  });

  it("returns 0.5 for mixed metrics", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0.5,
      memoryRetention: 0.5,
      contradictionPressure: 0.5,
      semanticDiffusion: 0.5,
    };
    expect(computeCoherenceIndex(metrics, undefined, CORE_INVERTED)).toBeCloseTo(0.5);
  });

  it("respects custom weights", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,
      memoryRetention: 0,
      contradictionPressure: 0,
      semanticDiffusion: 0,
    };
    // Weight only memoryRetention (which is 0, not inverted)
    const weights = { memoryRetention: 1 };
    expect(computeCoherenceIndex(metrics, weights, CORE_INVERTED)).toBeCloseTo(0);
  });

  it("treats all metrics as direct when no inverted set is given", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,
      memoryRetention: 1,
      contradictionPressure: 0,
      semanticDiffusion: 0,
    };
    // No inverted set → all direct → (0+1+0+0)/4 = 0.25
    expect(computeCoherenceIndex(metrics)).toBeCloseTo(0.25);
  });

  it("handles custom metric keys", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,
      memoryRetention: 1,
      contradictionPressure: 0,
      semanticDiffusion: 0,
      customMetric: 0.5,
    };
    const weights = { customMetric: 1 };
    expect(computeCoherenceIndex(metrics, weights)).toBeCloseTo(0.5);
  });

  it("returns 1 when no weights have values", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0.5,
      memoryRetention: 0.5,
      contradictionPressure: 0.5,
      semanticDiffusion: 0.5,
    };
    expect(computeCoherenceIndex(metrics, {})).toBe(1);
  });

  describe("invertedMetrics parameter", () => {
    it("inverts only metrics in the set", () => {
      const metrics: MetricSnapshot = {
        goalDrift: 0,
        memoryRetention: 1,
        contradictionPressure: 0,
        semanticDiffusion: 0,
        customBadMetric: 0.8,
      };
      const invertedSet = new Set(["customBadMetric"]);
      const weights = { customBadMetric: 1 };
      // 0.8 inverted → 0.2
      expect(computeCoherenceIndex(metrics, weights, invertedSet)).toBeCloseTo(0.2);
    });

    it("empty inverted set treats all metrics as direct", () => {
      const metrics: MetricSnapshot = {
        goalDrift: 0.7,
        memoryRetention: 0.3,
        contradictionPressure: 0,
        semanticDiffusion: 0,
      };
      const weights = { goalDrift: 1 };
      expect(computeCoherenceIndex(metrics, weights, new Set())).toBeCloseTo(0.7);
    });

    it("works with scalar metric names in inverted set", () => {
      const metrics: MetricSnapshot = {
        goalDrift: 0,
        memoryRetention: 1,
        contradictionPressure: 0,
        semanticDiffusion: 0,
        compactionPressure: 0.6,
        contextSaturation: 0.4,
      };
      const invertedSet = new Set([
        "goalDrift", "contradictionPressure", "semanticDiffusion",
        "compactionPressure", "contextSaturation",
      ]);
      const weights = { compactionPressure: 0.5, contextSaturation: 0.5 };
      // compactionPressure: 1-0.6=0.4, contextSaturation: 1-0.4=0.6
      // weighted: (0.4*0.5 + 0.6*0.5) / 1.0 = 0.5
      expect(computeCoherenceIndex(metrics, weights, invertedSet)).toBeCloseTo(0.5);
    });
  });
});

describe("classifyBand", () => {
  it("classifies green (>= 0.8)", () => {
    expect(classifyBand(1)).toBe("green");
    expect(classifyBand(0.8)).toBe("green");
    expect(classifyBand(0.95)).toBe("green");
  });

  it("classifies yellow (>= 0.6, < 0.8)", () => {
    expect(classifyBand(0.79)).toBe("yellow");
    expect(classifyBand(0.6)).toBe("yellow");
  });

  it("classifies orange (>= 0.4, < 0.6)", () => {
    expect(classifyBand(0.59)).toBe("orange");
    expect(classifyBand(0.4)).toBe("orange");
  });

  it("classifies red (< 0.4)", () => {
    expect(classifyBand(0.39)).toBe("red");
    expect(classifyBand(0)).toBe("red");
  });

  it("respects custom thresholds", () => {
    const thresholds = { green: 0.9, yellow: 0.7, orange: 0.5 };
    expect(classifyBand(0.85, thresholds)).toBe("yellow");
    expect(classifyBand(0.9, thresholds)).toBe("green");
  });
});
