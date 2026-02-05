import type { Tick } from "@peleke.s/cadence";
import type {
  Embedder,
  StateProvider,
  MetricWeights,
  MetricFn,
  MetricInput,
  MetricSnapshot,
  BandThresholds,
  CoherenceReading,
  ScalarMetricFn,
} from "./types.js";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "./types.js";
import { goalDriftMetric } from "./metrics/goal-drift.js";
import { memoryRetentionMetric } from "./metrics/memory-retention.js";
import { contradictionPressureMetric } from "./metrics/contradiction-pressure.js";
import { semanticDiffusionMetric } from "./metrics/semantic-diffusion.js";
import { computeCoherenceIndex, classifyBand, DEFAULT_INVERTED } from "./metrics/coherence-index.js";

/** Options for creating a PreExec sensor. */
export interface PreExecSensorOptions {
  /** Embedding provider. */
  embedder: Embedder;
  /** Agent state provider. */
  state: StateProvider;
  /**
   * Metric functions to run. Strategy pattern — swap, add, or remove metrics.
   * Default: [goalDrift, memoryRetention, contradictionPressure, semanticDiffusion]
   */
  metrics?: MetricFn[];
  /** Scalar metrics (no embeddings needed). Async-safe. */
  scalarMetrics?: ScalarMetricFn[];
  /** Weights for coherence index computation. */
  weights?: MetricWeights;
  /** Band classification thresholds. */
  thresholds?: BandThresholds;
  /** Called after each reading. */
  onReading?: (reading: CoherenceReading) => void | Promise<void>;
  /** Max readings to keep in history ring buffer. Default: 100. */
  historySize?: number;
}

/** PreExec sensor interface. */
export interface PreExecSensor {
  /** Take a coherence measurement at this tick. */
  measure(tick: Tick): Promise<CoherenceReading>;
  /** Get the N most recent readings (newest first). */
  history(n?: number): CoherenceReading[];
}

/** Default metric functions — the four core metrics. */
export const DEFAULT_METRICS: MetricFn[] = [
  goalDriftMetric,
  memoryRetentionMetric,
  contradictionPressureMetric,
  semanticDiffusionMetric,
];

/**
 * Create a PreExec coherence sensor.
 *
 * Orchestrates: StateProvider → Embedder → MetricFn[] → CoherenceReading.
 * Consumer wires it to a clock: `clock.start(tick => sensor.measure(tick))`.
 * Sensor does NOT touch the signal bus — it's a pure measurement tool.
 */
export function createPreExecSensor(options: PreExecSensorOptions): PreExecSensor {
  const {
    embedder,
    state,
    metrics = DEFAULT_METRICS,
    scalarMetrics = [],
    weights = DEFAULT_WEIGHTS,
    thresholds = DEFAULT_THRESHOLDS,
    onReading,
    historySize = 100,
  } = options;

  const readings: CoherenceReading[] = [];

  return {
    async measure(tick: Tick): Promise<CoherenceReading> {
      // 1. Gather state
      const [goals, context, goalRelevantMemories, allMemories] = await Promise.all([
        state.getGoals(),
        state.getRecentContext(),
        state.getGoalRelevantMemories(),
        state.getAllMemories(),
      ]);

      // 2. Embed everything in parallel
      const allTexts = [...goals, ...context, ...goalRelevantMemories, ...allMemories];

      // Deduplicate for embedding efficiency
      const uniqueTexts = [...new Set(allTexts)];
      const embeddingMap = new Map<string, number[]>();

      if (uniqueTexts.length > 0) {
        const embeddings = await embedder.embedBatch(uniqueTexts);
        for (let i = 0; i < uniqueTexts.length; i++) {
          embeddingMap.set(uniqueTexts[i]!, embeddings[i]!);
        }
      }

      const lookup = (texts: string[]): number[][] =>
        texts.map((t) => embeddingMap.get(t) ?? []);

      const input: MetricInput = {
        goalEmbeddings: lookup(goals),
        contextEmbeddings: lookup(context),
        memoryEmbeddings: lookup(allMemories),
        goalRelevantMemoryEmbeddings: lookup(goalRelevantMemories),
      };

      // 3. Compute embedding metrics via strategy pattern
      const snapshot = {} as MetricSnapshot;

      for (const metric of metrics) {
        snapshot[metric.name] = metric.compute(input);
      }

      // 3b. Compute scalar metrics (async, in parallel)
      if (scalarMetrics.length > 0) {
        const scalarResults = await Promise.all(
          scalarMetrics.map(async (m) => ({
            name: m.name,
            value: await m.compute(),
          })),
        );
        for (const { name, value } of scalarResults) {
          snapshot[name] = value;
        }
      }

      // 4. Build inverted set from metric declarations
      // If ANY metric declares inverted, use the declared set.
      // Otherwise fall back to DEFAULT_INVERTED for backwards compat.
      const anyDeclared = metrics.some((m) => m.inverted !== undefined)
        || scalarMetrics.some((m) => m.inverted !== undefined);

      let invertedSet: ReadonlySet<string>;
      if (anyDeclared) {
        const set = new Set<string>();
        for (const m of metrics) { if (m.inverted) set.add(m.name); }
        for (const m of scalarMetrics) { if (m.inverted) set.add(m.name); }
        invertedSet = set;
      } else {
        invertedSet = DEFAULT_INVERTED;
      }

      // 5. Compute coherence index and classify
      const coherenceIndex = computeCoherenceIndex(snapshot, weights, invertedSet);
      const band = classifyBand(coherenceIndex, thresholds);

      const reading: CoherenceReading = {
        ts: tick.ts,
        tickSeq: tick.seq,
        metrics: snapshot,
        coherenceIndex,
        band,
      };

      // 6. Store in ring buffer
      readings.push(reading);
      if (readings.length > historySize) {
        readings.shift();
      }

      // 7. Notify callback
      if (onReading) {
        await onReading(reading);
      }

      return reading;
    },

    history(n?: number): CoherenceReading[] {
      if (n === undefined) return [...readings].reverse();
      return readings.slice(-n).reverse();
    },
  };
}
