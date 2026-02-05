/**
 * End-to-end integration test: Cadence TestClock → PreExec Sensor
 *
 * Proves the full pipeline works:
 * TestClock ticks → sensor.measure(tick) → CoherenceReading with band
 */
import { describe, it, expect } from "vitest";
import { createTestClock } from "@peleke.s/cadence";
import { createPreExecSensor } from "./sensor.js";
import type { Embedder, StateProvider, CoherenceReading, MetricFn } from "./types.js";

// -- Mock Embedder: deterministic hash-based embedding --
function createMockEmbedder(dims = 8): Embedder {
  function hashEmbed(text: string): number[] {
    const vec = new Array(dims).fill(0) as number[];
    for (let i = 0; i < text.length; i++) {
      vec[i % dims]! += text.charCodeAt(i) / 500;
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? vec.map((v) => v / mag) : vec;
  }

  return {
    dimensions: dims,
    async embed(text: string) { return hashEmbed(text); },
    async embedBatch(texts: string[]) { return texts.map(hashEmbed); },
  };
}

// -- Mock StateProvider: simulates a focused vs. drifting agent --
function createFocusedAgent(): StateProvider {
  return {
    getGoals: async () => ["implement the login feature", "write tests for auth"],
    getRecentContext: async () => [
      "working on login form component",
      "added password validation",
      "writing unit tests for auth module",
    ],
    getGoalRelevantMemories: async () => [
      "login feature requires OAuth2",
      "auth tests should cover edge cases",
    ],
    getAllMemories: async () => [
      "login feature requires OAuth2",
      "auth tests should cover edge cases",
      "team standup at 10am",
      "deploy pipeline uses GitHub Actions",
    ],
  };
}

function createDriftingAgent(): StateProvider {
  return {
    getGoals: async () => ["implement the login feature", "write tests for auth"],
    getRecentContext: async () => [
      "browsing reddit",
      "thinking about lunch",
      "refactoring unrelated CSS",
      "watching YouTube",
    ],
    getGoalRelevantMemories: async () => [],
    getAllMemories: async () => [
      "something about lunch",
      "CSS grid is cool",
    ],
  };
}

describe("E2E: TestClock → PreExec Sensor", () => {
  it("focused agent gets higher coherence than drifting agent", async () => {
    const embedder = createMockEmbedder();

    const focusedSensor = createPreExecSensor({
      embedder,
      state: createFocusedAgent(),
    });

    const driftingSensor = createPreExecSensor({
      embedder,
      state: createDriftingAgent(),
    });

    const clock = createTestClock(1000);
    const focusedReadings: CoherenceReading[] = [];
    const driftingReadings: CoherenceReading[] = [];

    // Run focused agent
    clock.start(async (tick) => {
      focusedReadings.push(await focusedSensor.measure(tick));
    });
    await clock.tick(5);
    clock.stop();

    // Run drifting agent
    clock.start(async (tick) => {
      driftingReadings.push(await driftingSensor.measure(tick));
    });
    await clock.tick(5);
    clock.stop();

    // Focused agent should have higher coherence
    const focusedAvg = focusedReadings.reduce((s, r) => s + r.coherenceIndex, 0) / focusedReadings.length;
    const driftingAvg = driftingReadings.reduce((s, r) => s + r.coherenceIndex, 0) / driftingReadings.length;

    expect(focusedAvg).toBeGreaterThan(driftingAvg);
    expect(focusedReadings).toHaveLength(5);
    expect(driftingReadings).toHaveLength(5);

    // Both should have proper tick sequences
    expect(focusedReadings[0]!.tickSeq).toBe(0);
    expect(focusedReadings[4]!.tickSeq).toBe(4);
  });

  it("sensor history tracks across ticks", async () => {
    const sensor = createPreExecSensor({
      embedder: createMockEmbedder(),
      state: createFocusedAgent(),
    });

    const clock = createTestClock(500);
    clock.start(async (tick) => {
      await sensor.measure(tick);
    });

    await clock.tick(10);
    clock.stop();

    const history = sensor.history();
    expect(history).toHaveLength(10);
    // Newest first
    expect(history[0]!.tickSeq).toBe(9);
    expect(history[9]!.tickSeq).toBe(0);

    // All readings should have consistent bands
    for (const reading of history) {
      expect(["green", "yellow", "orange", "red"]).toContain(reading.band);
      expect(reading.coherenceIndex).toBeGreaterThanOrEqual(0);
      expect(reading.coherenceIndex).toBeLessThanOrEqual(1);
    }
  });

  it("custom metric plugs in cleanly", async () => {
    // Custom metric: "focus score" = inverted diffusion
    const focusScore: MetricFn = {
      name: "focusScore",
      compute(input) {
        const n = input.contextEmbeddings.length;
        if (n < 2) return 1; // Single context = fully focused
        // Simple: mean pairwise similarity (higher = more focused)
        let totalSim = 0;
        let pairs = 0;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = input.contextEmbeddings[i]!;
            const b = input.contextEmbeddings[j]!;
            const dot = a.reduce((s, v, k) => s + v * b[k]!, 0);
            const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
            const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
            totalSim += magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
            pairs++;
          }
        }
        return Math.max(0, Math.min(1, totalSim / pairs));
      },
    };

    const sensor = createPreExecSensor({
      embedder: createMockEmbedder(),
      state: createFocusedAgent(),
      metrics: [focusScore],
      weights: { focusScore: 1 },
    });

    const clock = createTestClock(1000);
    clock.start(async (tick) => {
      await sensor.measure(tick);
    });
    await clock.tick(3);
    clock.stop();

    const history = sensor.history(3);
    for (const reading of history) {
      expect(reading.metrics["focusScore"]).toBeDefined();
      expect(typeof reading.metrics["focusScore"]).toBe("number");
      // focusScore is not in the "inverted" set, so coherenceIndex = focusScore
      expect(reading.coherenceIndex).toBeCloseTo(reading.metrics["focusScore"]!);
    }
  });

  it("advanceBy works through the pipeline", async () => {
    const sensor = createPreExecSensor({
      embedder: createMockEmbedder(),
      state: createFocusedAgent(),
    });

    const clock = createTestClock(100);
    clock.start(async (tick) => {
      await sensor.measure(tick);
    });

    // Advance 350ms = 3 ticks + 50ms residual
    await clock.advanceBy(350);
    expect(sensor.history()).toHaveLength(3);

    // Flush residual
    await clock.flush();
    expect(sensor.history()).toHaveLength(4);

    clock.stop();
  });
});
