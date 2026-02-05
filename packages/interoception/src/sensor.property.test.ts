import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createPreExecSensor } from "./sensor.js";
import type {
  Embedder,
  StateProvider,
  MetricFn,
  ScalarMetricFn,
} from "./types.js";
import type { Tick } from "@peleke.s/cadence";

function createMockEmbedder(dims = 4): Embedder {
  function embed(text: string): number[] {
    const vec = new Array(dims).fill(0) as number[];
    for (let i = 0; i < text.length; i++) {
      vec[i % dims]! += text.charCodeAt(i) / 1000;
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (mag > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i]! / mag;
      }
    }
    return vec;
  }

  return {
    dimensions: dims,
    async embed(text: string) { return embed(text); },
    async embedBatch(texts: string[]) { return texts.map(embed); },
  };
}

function createMockState(overrides?: Partial<StateProvider>): StateProvider {
  return {
    getGoals: overrides?.getGoals ?? (async () => ["goal"]),
    getRecentContext: overrides?.getRecentContext ?? (async () => ["context"]),
    getGoalRelevantMemories: overrides?.getGoalRelevantMemories ?? (async () => ["memory"]),
    getAllMemories: overrides?.getAllMemories ?? (async () => ["memory"]),
  };
}

function makeTick(seq: number): Tick {
  return { ts: seq * 1000, seq, reason: "manual" };
}

describe("sensor — property tests", () => {
  it("coherenceIndex is always in [0, 1] for any scalar metric values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        async (val1, val2, inv1, inv2) => {
          const s1: ScalarMetricFn = { name: "s1", inverted: inv1, compute: () => val1 };
          const s2: ScalarMetricFn = { name: "s2", inverted: inv2, compute: () => val2 };

          const sensor = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [],
            scalarMetrics: [s1, s2],
            weights: { s1: 0.5, s2: 0.5 },
          });

          const reading = await sensor.measure(makeTick(0));
          expect(reading.coherenceIndex).toBeGreaterThanOrEqual(0);
          expect(reading.coherenceIndex).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it("adding a noop scalar metric (value 0, no weight) does not change the index", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (metricVal) => {
          const mainMetric: MetricFn = {
            name: "main",
            inverted: true,
            compute: () => metricVal,
          };

          const sensorWithout = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [mainMetric],
            weights: { main: 1 },
          });

          const noopScalar: ScalarMetricFn = {
            name: "noop",
            inverted: false,
            compute: () => 0,
          };

          const sensorWith = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [mainMetric],
            scalarMetrics: [noopScalar],
            weights: { main: 1 }, // noop has no weight
          });

          const r1 = await sensorWithout.measure(makeTick(0));
          const r2 = await sensorWith.measure(makeTick(0));
          expect(r2.coherenceIndex).toBeCloseTo(r1.coherenceIndex, 5);
        },
      ),
    );
  });
});

describe("sensor — metamorphic tests", () => {
  it("inverting a metric and flipping its value preserves the index", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (val) => {
          const directScalar: ScalarMetricFn = {
            name: "sig",
            inverted: false,
            compute: () => val,
          };

          const invertedScalar: ScalarMetricFn = {
            name: "sig",
            inverted: true,
            compute: () => 1 - val,
          };

          const sensor1 = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [],
            scalarMetrics: [directScalar],
            weights: { sig: 1 },
          });

          const sensor2 = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [],
            scalarMetrics: [invertedScalar],
            weights: { sig: 1 },
          });

          const r1 = await sensor1.measure(makeTick(0));
          const r2 = await sensor2.measure(makeTick(0));
          // direct(val) should equal inverted(1-val) → both give coherenceValue = val
          expect(r2.coherenceIndex).toBeCloseTo(r1.coherenceIndex, 5);
        },
      ),
    );
  });

  it("doubling all weights does not change the coherence index", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (v1, v2) => {
          const m1: ScalarMetricFn = { name: "a", inverted: true, compute: () => v1 };
          const m2: ScalarMetricFn = { name: "b", inverted: false, compute: () => v2 };

          const sensor1 = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [],
            scalarMetrics: [m1, m2],
            weights: { a: 0.3, b: 0.7 },
          });

          const sensor2 = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
            metrics: [],
            scalarMetrics: [m1, m2],
            weights: { a: 0.6, b: 1.4 },
          });

          const r1 = await sensor1.measure(makeTick(0));
          const r2 = await sensor2.measure(makeTick(0));
          expect(r2.coherenceIndex).toBeCloseTo(r1.coherenceIndex, 5);
        },
      ),
    );
  });

  it("history length equals number of successful measure() calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (n) => {
          const sensor = createPreExecSensor({
            embedder: createMockEmbedder(),
            state: createMockState(),
          });

          for (let i = 0; i < n; i++) {
            await sensor.measure(makeTick(i));
          }

          expect(sensor.history()).toHaveLength(n);
        },
      ),
    );
  });
});
