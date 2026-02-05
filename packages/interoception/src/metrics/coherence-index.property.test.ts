import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeCoherenceIndex, classifyBand } from "./coherence-index.js";
import type { MetricSnapshot, MetricWeights } from "../types.js";

/** Inverted set matching core metric polarity declarations. */
const CORE_INVERTED = new Set(["goalDrift", "contradictionPressure", "semanticDiffusion"]);

const metricValue = fc.double({ min: 0, max: 1, noNaN: true });

const standardSnapshot = fc.record({
  goalDrift: metricValue,
  memoryRetention: metricValue,
  contradictionPressure: metricValue,
  semanticDiffusion: metricValue,
}) as fc.Arbitrary<MetricSnapshot>;

const positiveWeight = fc.double({ min: 0.01, max: 1, noNaN: true });

const standardWeights = fc.record({
  goalDrift: positiveWeight,
  memoryRetention: positiveWeight,
  contradictionPressure: positiveWeight,
  semanticDiffusion: positiveWeight,
});

describe("computeCoherenceIndex — property tests", () => {
  it("always returns a value in [0, 1]", () => {
    fc.assert(
      fc.property(standardSnapshot, standardWeights, (metrics, weights) => {
        const index = computeCoherenceIndex(metrics, weights, CORE_INVERTED);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("returns 1 when all inverted metrics are 0 and all direct metrics are 1", () => {
    fc.assert(
      fc.property(standardWeights, (weights) => {
        const perfect: MetricSnapshot = {
          goalDrift: 0,
          memoryRetention: 1,
          contradictionPressure: 0,
          semanticDiffusion: 0,
        };
        expect(computeCoherenceIndex(perfect, weights, CORE_INVERTED)).toBeCloseTo(1, 5);
      }),
    );
  });

  it("returns 0 when all inverted metrics are 1 and all direct metrics are 0", () => {
    fc.assert(
      fc.property(standardWeights, (weights) => {
        const worst: MetricSnapshot = {
          goalDrift: 1,
          memoryRetention: 0,
          contradictionPressure: 1,
          semanticDiffusion: 1,
        };
        expect(computeCoherenceIndex(worst, weights, CORE_INVERTED)).toBeCloseTo(0, 5);
      }),
    );
  });

  it("is monotonic: improving a metric never decreases the index", () => {
    fc.assert(
      fc.property(
        standardSnapshot,
        standardWeights,
        fc.constantFrom("goalDrift", "memoryRetention", "contradictionPressure", "semanticDiffusion"),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        (metrics, weights, metricName, delta) => {
          const original = computeCoherenceIndex(metrics, weights, CORE_INVERTED);

          const improved = { ...metrics };
          if (CORE_INVERTED.has(metricName)) {
            improved[metricName] = Math.max(0, metrics[metricName]! - delta);
          } else {
            improved[metricName] = Math.min(1, metrics[metricName]! + delta);
          }

          const after = computeCoherenceIndex(improved, weights, CORE_INVERTED);
          expect(after).toBeGreaterThanOrEqual(original - 1e-10);
        },
      ),
    );
  });

  it("inverting a metric and flipping its value preserves the index", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (value) => {
          const metrics: MetricSnapshot = {
            goalDrift: 0,
            memoryRetention: 0,
            contradictionPressure: 0,
            semanticDiffusion: 0,
            custom: value,
          };
          const weights: MetricWeights = { custom: 1 };

          const direct = computeCoherenceIndex(metrics, weights, new Set());
          const inverted = computeCoherenceIndex(metrics, weights, new Set(["custom"]));

          expect(inverted).toBeCloseTo(1 - direct, 5);
        },
      ),
    );
  });
});

describe("computeCoherenceIndex — metamorphic tests", () => {
  it("weight scaling: multiplying all weights by a constant does not change the index", () => {
    fc.assert(
      fc.property(
        standardSnapshot,
        standardWeights,
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (metrics, weights, scale) => {
          const original = computeCoherenceIndex(metrics, weights, CORE_INVERTED);
          const scaled: MetricWeights = {};
          for (const [k, v] of Object.entries(weights)) {
            scaled[k] = v! * scale;
          }
          const after = computeCoherenceIndex(metrics, scaled, CORE_INVERTED);
          expect(after).toBeCloseTo(original, 5);
        },
      ),
    );
  });

  it("metric swap: swapping two inverted metrics with same weight preserves the index", () => {
    fc.assert(
      fc.property(
        metricValue,
        metricValue,
        metricValue,
        metricValue,
        (gd, mr, cp, sd) => {
          const snapshotA: MetricSnapshot = {
            goalDrift: gd,
            memoryRetention: mr,
            contradictionPressure: cp,
            semanticDiffusion: sd,
          };
          const snapshotB: MetricSnapshot = {
            goalDrift: cp,
            memoryRetention: mr,
            contradictionPressure: gd,
            semanticDiffusion: sd,
          };
          const equalWeights: MetricWeights = {
            goalDrift: 0.25,
            memoryRetention: 0.25,
            contradictionPressure: 0.25,
            semanticDiffusion: 0.25,
          };
          const indexA = computeCoherenceIndex(snapshotA, equalWeights, CORE_INVERTED);
          const indexB = computeCoherenceIndex(snapshotB, equalWeights, CORE_INVERTED);
          expect(indexA).toBeCloseTo(indexB, 5);
        },
      ),
    );
  });

  it("zero-weight metric: changing a metric with zero weight does not change the index", () => {
    fc.assert(
      fc.property(
        standardSnapshot,
        metricValue,
        (metrics, newValue) => {
          const weights: MetricWeights = {
            goalDrift: 0,
            memoryRetention: 1,
            contradictionPressure: 0,
            semanticDiffusion: 0,
          };
          const original = computeCoherenceIndex(metrics, weights, CORE_INVERTED);
          const modified = { ...metrics, goalDrift: newValue };
          const after = computeCoherenceIndex(modified, weights, CORE_INVERTED);
          expect(after).toBeCloseTo(original, 5);
        },
      ),
    );
  });

  it("additivity: index is a weighted average of individual metric contributions", () => {
    fc.assert(
      fc.property(standardSnapshot, standardWeights, (metrics, weights) => {
        const combined = computeCoherenceIndex(metrics, weights, CORE_INVERTED);

        let expectedSum = 0;
        let totalWeight = 0;
        for (const [key, weight] of Object.entries(weights)) {
          if (!weight) continue;
          const value = metrics[key];
          if (value === undefined) continue;
          const coherenceValue = CORE_INVERTED.has(key) ? 1 - value : value;
          expectedSum += coherenceValue * weight;
          totalWeight += weight;
        }
        const expected = totalWeight > 0 ? expectedSum / totalWeight : 1;

        expect(combined).toBeCloseTo(expected, 5);
      }),
    );
  });
});

describe("classifyBand — property tests", () => {
  it("every value in [0, 1] maps to a valid band", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (value) => {
        const band = classifyBand(value);
        expect(["green", "yellow", "orange", "red"]).toContain(band);
      }),
    );
  });

  it("band ordering: higher values never produce lower bands", () => {
    const bandOrder = { red: 0, orange: 1, yellow: 2, green: 3 };
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const lower = Math.min(a, b);
          const higher = Math.max(a, b);
          const bandLow = classifyBand(lower);
          const bandHigh = classifyBand(higher);
          expect(bandOrder[bandHigh]).toBeGreaterThanOrEqual(bandOrder[bandLow]);
        },
      ),
    );
  });
});
