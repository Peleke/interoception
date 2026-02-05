import { describe, it, expect } from "vitest";
import { computeCoherenceIndex, classifyBand, DEFAULT_INVERTED } from "./coherence-index.js";
import type { MetricSnapshot } from "../types.js";

describe("computeCoherenceIndex", () => {
  it("returns 1 for perfect coherence", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,           // 0 drift = good → inverted to 1
      memoryRetention: 1,     // 1 = good, not inverted
      contradictionPressure: 0, // 0 = good → inverted to 1
      semanticDiffusion: 0,    // 0 = good → inverted to 1
    };
    expect(computeCoherenceIndex(metrics)).toBeCloseTo(1);
  });

  it("returns 0 for total incoherence", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 1,
      memoryRetention: 0,
      contradictionPressure: 1,
      semanticDiffusion: 1,
    };
    expect(computeCoherenceIndex(metrics)).toBeCloseTo(0);
  });

  it("returns 0.5 for mixed metrics", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0.5,
      memoryRetention: 0.5,
      contradictionPressure: 0.5,
      semanticDiffusion: 0.5,
    };
    expect(computeCoherenceIndex(metrics)).toBeCloseTo(0.5);
  });

  it("respects custom weights", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,            // → 1 after inversion
      memoryRetention: 0,      // 0, not inverted
      contradictionPressure: 0, // → 1 after inversion
      semanticDiffusion: 0,     // → 1 after inversion
    };
    // Weight only memoryRetention (which is 0)
    const weights = { memoryRetention: 1 };
    expect(computeCoherenceIndex(metrics, weights)).toBeCloseTo(0);
  });

  it("handles custom metric keys", () => {
    const metrics: MetricSnapshot = {
      goalDrift: 0,
      memoryRetention: 1,
      contradictionPressure: 0,
      semanticDiffusion: 0,
      customMetric: 0.5,
    };
    // Custom metric not in "inverted" set, treated as direct value
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

  describe("custom invertedMetrics parameter", () => {
    it("uses custom inverted set instead of default", () => {
      const metrics: MetricSnapshot = {
        goalDrift: 0,
        memoryRetention: 1,
        contradictionPressure: 0,
        semanticDiffusion: 0,
        customBadMetric: 0.8,
      };
      // Only customBadMetric is inverted
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
      // goalDrift NOT inverted → direct value 0.7
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

describe("DEFAULT_INVERTED", () => {
  it("contains the three inverted core metrics", () => {
    expect(DEFAULT_INVERTED.has("goalDrift")).toBe(true);
    expect(DEFAULT_INVERTED.has("contradictionPressure")).toBe(true);
    expect(DEFAULT_INVERTED.has("semanticDiffusion")).toBe(true);
  });

  it("does not contain memoryRetention", () => {
    expect(DEFAULT_INVERTED.has("memoryRetention")).toBe(false);
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
