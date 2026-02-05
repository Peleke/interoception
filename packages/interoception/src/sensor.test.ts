import { describe, it, expect, vi } from "vitest";
import { createPreExecSensor, DEFAULT_METRICS } from "./sensor.js";
import type {
  Embedder,
  StateProvider,
  CoherenceReading,
  MetricFn,
  MetricInput,
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
});
