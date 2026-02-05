import { describe, it, expect, vi } from "vitest";
import { createPreExecSensor, DEFAULT_METRICS } from "./sensor.js";
import type {
  Embedder,
  StateProvider,
  MetricFn,
  MetricInput,
  ScalarMetricFn,
} from "./types.js";
import type { Tick } from "@peleke.s/cadence";

/**
 * Mock embedder that maps text to simple vectors.
 * Each word gets a dimension; vector[i] = 1 if word is present.
 * Crude but deterministic for testing.
 */
function createMockEmbedder(dims = 4): Embedder {
  // Simple hash-based embedding: deterministic, not random
  function embed(text: string): number[] {
    const vec = new Array(dims).fill(0) as number[];
    for (let i = 0; i < text.length; i++) {
      vec[i % dims]! += text.charCodeAt(i) / 1000;
    }
    // Normalize
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
    async embed(text: string): Promise<number[]> {
      return embed(text);
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map(embed);
    },
  };
}

function createMockState(overrides?: Partial<StateProvider>): StateProvider {
  return {
    getGoals: overrides?.getGoals ?? (async () => ["build features", "fix bugs"]),
    getRecentContext: overrides?.getRecentContext ?? (async () => ["working on feature X", "reviewed PR"]),
    getGoalRelevantMemories: overrides?.getGoalRelevantMemories ?? (async () => ["feature X is important", "fix bugs first"]),
    getAllMemories: overrides?.getAllMemories ?? (async () => ["feature X is important", "fix bugs first", "had lunch"]),
  };
}

function makeTick(seq: number, ts = seq * 1000): Tick {
  return { ts, seq, reason: "manual" };
}

describe("createPreExecSensor", () => {
  it("produces a CoherenceReading with all fields", async () => {
    const sensor = createPreExecSensor({
      embedder: createMockEmbedder(),
      state: createMockState(),
    });

    const reading = await sensor.measure(makeTick(0));

    expect(reading.ts).toBe(0);
    expect(reading.tickSeq).toBe(0);
    expect(reading.metrics).toBeDefined();
    expect(typeof reading.metrics.goalDrift).toBe("number");
    expect(typeof reading.metrics.memoryRetention).toBe("number");
    expect(typeof reading.metrics.contradictionPressure).toBe("number");
    expect(typeof reading.metrics.semanticDiffusion).toBe("number");
    expect(typeof reading.coherenceIndex).toBe("number");
    expect(reading.coherenceIndex).toBeGreaterThanOrEqual(0);
    expect(reading.coherenceIndex).toBeLessThanOrEqual(1);
    expect(["green", "yellow", "orange", "red"]).toContain(reading.band);
  });

  it("calls state provider for each measurement", async () => {
    const getGoals = vi.fn(async () => ["goal"]);
    const getRecentContext = vi.fn(async () => ["context"]);
    const getGoalRelevantMemories = vi.fn(async () => ["memory"]);
    const getAllMemories = vi.fn(async () => ["memory"]);

    const sensor = createPreExecSensor({
      embedder: createMockEmbedder(),
      state: {
        getGoals,
        getRecentContext,
        getGoalRelevantMemories,
        getAllMemories,
      },
    });

    await sensor.measure(makeTick(0));

    expect(getGoals).toHaveBeenCalledOnce();
    expect(getRecentContext).toHaveBeenCalledOnce();
    expect(getGoalRelevantMemories).toHaveBeenCalledOnce();
    expect(getAllMemories).toHaveBeenCalledOnce();
  });

  it("deduplicates texts before embedding", async () => {
    const embedBatch = vi.fn(async (texts: string[]) =>
      texts.map(() => [0.5, 0.5, 0.5, 0.5]),
    );

    const sensor = createPreExecSensor({
      embedder: {
        dimensions: 4,
        embed: async () => [0.5, 0.5, 0.5, 0.5],
        embedBatch,
      },
      state: createMockState({
        // Same text appears in multiple state fields
        getGoals: async () => ["shared text"],
        getRecentContext: async () => ["shared text"],
        getGoalRelevantMemories: async () => ["shared text"],
        getAllMemories: async () => ["shared text"],
      }),
    });

    await sensor.measure(makeTick(0));

    // Should only embed "shared text" once
    expect(embedBatch).toHaveBeenCalledWith(["shared text"]);
  });

  describe("custom metrics (strategy pattern)", () => {
    it("uses custom metric functions instead of defaults", async () => {
      const customMetric: MetricFn = {
        name: "vibeCheck",
        compute: (_input: MetricInput) => 0.42,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [customMetric],
        weights: { vibeCheck: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["vibeCheck"]).toBe(0.42);
      // vibeCheck is not in the "inverted" set, so coherenceIndex = 0.42
      expect(reading.coherenceIndex).toBeCloseTo(0.42);
    });

    it("can mix default and custom metrics", async () => {
      const customMetric: MetricFn = {
        name: "customSignal",
        compute: () => 0.9,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [...DEFAULT_METRICS, customMetric],
        weights: {
          goalDrift: 0.2,
          memoryRetention: 0.2,
          contradictionPressure: 0.2,
          semanticDiffusion: 0.2,
          customSignal: 0.2,
        },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["customSignal"]).toBe(0.9);
    });
  });

  describe("history", () => {
    it("stores readings in history", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
      });

      await sensor.measure(makeTick(0));
      await sensor.measure(makeTick(1));
      await sensor.measure(makeTick(2));

      const history = sensor.history();
      expect(history).toHaveLength(3);
      // Newest first
      expect(history[0]!.tickSeq).toBe(2);
      expect(history[2]!.tickSeq).toBe(0);
    });

    it("limits history to N most recent", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
      });

      for (let i = 0; i < 5; i++) {
        await sensor.measure(makeTick(i));
      }

      const last2 = sensor.history(2);
      expect(last2).toHaveLength(2);
      expect(last2[0]!.tickSeq).toBe(4);
      expect(last2[1]!.tickSeq).toBe(3);
    });

    it("respects historySize ring buffer", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        historySize: 3,
      });

      for (let i = 0; i < 5; i++) {
        await sensor.measure(makeTick(i));
      }

      const history = sensor.history();
      expect(history).toHaveLength(3);
      expect(history[0]!.tickSeq).toBe(4);
      expect(history[2]!.tickSeq).toBe(2);
    });
  });

  describe("onReading callback", () => {
    it("calls onReading after each measurement", async () => {
      const onReading = vi.fn();
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        onReading,
      });

      await sensor.measure(makeTick(0));
      expect(onReading).toHaveBeenCalledOnce();
      expect(onReading.mock.calls[0]![0]).toHaveProperty("band");
    });
  });

  describe("error propagation", () => {
    it("propagates embedder errors to caller", async () => {
      const sensor = createPreExecSensor({
        embedder: {
          dimensions: 4,
          embed: async () => { throw new Error("embedding service down"); },
          embedBatch: async () => { throw new Error("embedding service down"); },
        },
        state: createMockState(),
      });

      await expect(sensor.measure(makeTick(0))).rejects.toThrow("embedding service down");
    });

    it("propagates state provider errors to caller", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState({
          getGoals: async () => { throw new Error("state unavailable"); },
        }),
      });

      await expect(sensor.measure(makeTick(0))).rejects.toThrow("state unavailable");
    });

    it("does not store reading in history on error", async () => {
      const sensor = createPreExecSensor({
        embedder: {
          dimensions: 4,
          embed: async () => { throw new Error("fail"); },
          embedBatch: async () => { throw new Error("fail"); },
        },
        state: createMockState(),
      });

      await sensor.measure(makeTick(0)).catch(() => {});
      expect(sensor.history()).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty state gracefully", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState({
          getGoals: async () => [],
          getRecentContext: async () => [],
          getGoalRelevantMemories: async () => [],
          getAllMemories: async () => [],
        }),
      });

      const reading = await sensor.measure(makeTick(0));
      // Empty state = no drift, no retention, no contradiction, no diffusion
      // All metrics should be 0
      expect(reading.metrics.goalDrift).toBe(0);
      expect(reading.metrics.memoryRetention).toBe(0);
      expect(reading.metrics.contradictionPressure).toBe(0);
      expect(reading.metrics.semanticDiffusion).toBe(0);
      // Coherence index with all zeros: (1-0) + 0 + (1-0) + (1-0) / 4 = 0.75
      // Wait: goalDrift=0 → inverted → 1, memRetention=0 → 0, contPressure=0 → inverted → 1, semDiff=0 → inverted → 1
      // (1 + 0 + 1 + 1) * 0.25 = 0.75
      expect(reading.coherenceIndex).toBeCloseTo(0.75);
      expect(reading.band).toBe("yellow");
    });
  });

  describe("scalar metrics", () => {
    it("runs scalar-only sensor (no embedding metrics)", async () => {
      const scalar: ScalarMetricFn = {
        name: "compactionPressure",
        inverted: true,
        compute: () => 0.3,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [],
        scalarMetrics: [scalar],
        weights: { compactionPressure: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["compactionPressure"]).toBe(0.3);
      // inverted: 1 - 0.3 = 0.7
      expect(reading.coherenceIndex).toBeCloseTo(0.7);
    });

    it("runs mixed embedding + scalar metrics", async () => {
      const scalar: ScalarMetricFn = {
        name: "contextSaturation",
        inverted: true,
        compute: () => 0.5,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        scalarMetrics: [scalar],
        weights: {
          goalDrift: 0.2,
          memoryRetention: 0.2,
          contradictionPressure: 0.2,
          semanticDiffusion: 0.2,
          contextSaturation: 0.2,
        },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(typeof reading.metrics.goalDrift).toBe("number");
      expect(reading.metrics["contextSaturation"]).toBe(0.5);
    });

    it("handles async scalar metrics", async () => {
      const asyncScalar: ScalarMetricFn = {
        name: "toolUncertainty",
        inverted: true,
        compute: async () => {
          // Simulate async DB read
          await new Promise((r) => setTimeout(r, 1));
          return 0.7;
        },
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [],
        scalarMetrics: [asyncScalar],
        weights: { toolUncertainty: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["toolUncertainty"]).toBe(0.7);
      // inverted: 1 - 0.7 = 0.3
      expect(reading.coherenceIndex).toBeCloseTo(0.3);
    });

    it("handles scalar metric that noops (returns 0)", async () => {
      const noopScalar: ScalarMetricFn = {
        name: "compactionPressure",
        inverted: true,
        compute: () => 0, // data source unavailable → noop
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [],
        scalarMetrics: [noopScalar],
        weights: { compactionPressure: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["compactionPressure"]).toBe(0);
      // inverted: 1 - 0 = 1 (fresh context = fully coherent)
      expect(reading.coherenceIndex).toBeCloseTo(1);
    });

    it("runs multiple scalar metrics in parallel", async () => {
      const callOrder: string[] = [];

      const scalar1: ScalarMetricFn = {
        name: "compactionPressure",
        inverted: true,
        compute: async () => {
          callOrder.push("start-compaction");
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push("end-compaction");
          return 0.4;
        },
      };

      const scalar2: ScalarMetricFn = {
        name: "contextSaturation",
        inverted: true,
        compute: async () => {
          callOrder.push("start-saturation");
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push("end-saturation");
          return 0.6;
        },
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [],
        scalarMetrics: [scalar1, scalar2],
        weights: { compactionPressure: 0.5, contextSaturation: 0.5 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["compactionPressure"]).toBe(0.4);
      expect(reading.metrics["contextSaturation"]).toBe(0.6);

      // Both should start before either ends (parallel execution)
      expect(callOrder.indexOf("start-compaction")).toBeLessThan(callOrder.indexOf("end-saturation"));
      expect(callOrder.indexOf("start-saturation")).toBeLessThan(callOrder.indexOf("end-compaction"));
    });

    it("propagates scalar metric errors to caller", async () => {
      const failingScalar: ScalarMetricFn = {
        name: "broken",
        compute: async () => { throw new Error("DB connection failed"); },
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [],
        scalarMetrics: [failingScalar],
        weights: { broken: 1 },
      });

      await expect(sensor.measure(makeTick(0))).rejects.toThrow("DB connection failed");
    });

    it("does not call embedder when only scalar metrics are used with empty state", async () => {
      const embedBatch = vi.fn(async (texts: string[]) =>
        texts.map(() => [0.5, 0.5, 0.5, 0.5]),
      );

      const scalar: ScalarMetricFn = {
        name: "contextSaturation",
        inverted: true,
        compute: () => 0.2,
      };

      const sensor = createPreExecSensor({
        embedder: {
          dimensions: 4,
          embed: async () => [0.5, 0.5, 0.5, 0.5],
          embedBatch,
        },
        state: createMockState({
          getGoals: async () => [],
          getRecentContext: async () => [],
          getGoalRelevantMemories: async () => [],
          getAllMemories: async () => [],
        }),
        metrics: [],
        scalarMetrics: [scalar],
        weights: { contextSaturation: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      // embedBatch should NOT be called since uniqueTexts is empty
      expect(embedBatch).not.toHaveBeenCalled();
      expect(reading.metrics["contextSaturation"]).toBe(0.2);
    });
  });

  describe("inverted flag on MetricFn", () => {
    it("respects inverted: true on embedding metric", async () => {
      const invertedMetric: MetricFn = {
        name: "badSignal",
        inverted: true,
        compute: () => 0.8, // high = bad
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [invertedMetric],
        weights: { badSignal: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["badSignal"]).toBe(0.8);
      // inverted: 1 - 0.8 = 0.2
      expect(reading.coherenceIndex).toBeCloseTo(0.2);
    });

    it("respects inverted: false on embedding metric (direct value)", async () => {
      const directMetric: MetricFn = {
        name: "goodSignal",
        inverted: false,
        compute: () => 0.8, // high = good
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [directMetric],
        weights: { goodSignal: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      expect(reading.metrics["goodSignal"]).toBe(0.8);
      // not inverted: 0.8
      expect(reading.coherenceIndex).toBeCloseTo(0.8);
    });

    it("builds inverted set from both MetricFn and ScalarMetricFn", async () => {
      const embeddingMetric: MetricFn = {
        name: "drift",
        inverted: true,
        compute: () => 0.6,
      };

      const scalarMetric: ScalarMetricFn = {
        name: "pressure",
        inverted: true,
        compute: () => 0.4,
      };

      const directScalar: ScalarMetricFn = {
        name: "quality",
        inverted: false,
        compute: () => 0.9,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [embeddingMetric],
        scalarMetrics: [scalarMetric, directScalar],
        weights: { drift: 1/3, pressure: 1/3, quality: 1/3 },
      });

      const reading = await sensor.measure(makeTick(0));
      // drift: inverted → 1-0.6=0.4
      // pressure: inverted → 1-0.4=0.6
      // quality: direct → 0.9
      // weighted avg: (0.4 + 0.6 + 0.9) / 3 ≈ 0.633
      expect(reading.coherenceIndex).toBeCloseTo(0.633, 2);
    });

    it("falls back to DEFAULT_INVERTED when no metric declares inverted", async () => {
      // Custom metrics without inverted flag → use DEFAULT_INVERTED
      const customMetric: MetricFn = {
        name: "goalDrift", // same name as default inverted metric
        compute: () => 0.8,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [customMetric],
        weights: { goalDrift: 1 },
      });

      const reading = await sensor.measure(makeTick(0));
      // goalDrift is in DEFAULT_INVERTED → 1 - 0.8 = 0.2
      expect(reading.coherenceIndex).toBeCloseTo(0.2);
    });

    it("uses declared set (not DEFAULT_INVERTED) when any metric has inverted flag", async () => {
      // One metric declares inverted, another doesn't → only declared ones are inverted
      const metricA: MetricFn = {
        name: "goalDrift", // would be in DEFAULT_INVERTED, but no flag
        compute: () => 0.8,
      };

      const metricB: MetricFn = {
        name: "customInverted",
        inverted: true,
        compute: () => 0.5,
      };

      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
        metrics: [metricA, metricB],
        weights: { goalDrift: 0.5, customInverted: 0.5 },
      });

      const reading = await sensor.measure(makeTick(0));
      // metricB declares inverted → triggers declared-set mode
      // goalDrift: no inverted flag → NOT in declared set → direct: 0.8
      // customInverted: inverted → 1-0.5 = 0.5
      // weighted: (0.8*0.5 + 0.5*0.5) / 1.0 = 0.65
      expect(reading.coherenceIndex).toBeCloseTo(0.65);
    });
  });

  describe("backwards compatibility", () => {
    it("default metrics still declare correct polarity", async () => {
      // DEFAULT_METRICS now have inverted flags — sensor should use them
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState({
          getGoals: async () => [],
          getRecentContext: async () => [],
          getGoalRelevantMemories: async () => [],
          getAllMemories: async () => [],
        }),
      });

      const reading = await sensor.measure(makeTick(0));
      // All zeros: goalDrift(inv)→1, memRet(direct)→0, contPressure(inv)→1, semDiff(inv)→1
      // (1+0+1+1)*0.25 = 0.75
      expect(reading.coherenceIndex).toBeCloseTo(0.75);
      expect(reading.band).toBe("yellow");
    });

    it("sensor works identically without scalarMetrics option", async () => {
      const sensor = createPreExecSensor({
        embedder: createMockEmbedder(),
        state: createMockState(),
      });

      const reading = await sensor.measure(makeTick(0));
      expect(typeof reading.metrics.goalDrift).toBe("number");
      expect(typeof reading.metrics.memoryRetention).toBe("number");
      expect(typeof reading.metrics.contradictionPressure).toBe("number");
      expect(typeof reading.metrics.semanticDiffusion).toBe("number");
      expect(reading.coherenceIndex).toBeGreaterThanOrEqual(0);
      expect(reading.coherenceIndex).toBeLessThanOrEqual(1);
    });
  });
});
