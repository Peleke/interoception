/**
 * @peleke.s/interoception — Coherence sensing for autonomous AI agents.
 *
 * @packageDocumentation
 */

// Core types
export type {
  Embedder,
  StateProvider,
  MetricSnapshot,
  MetricWeights,
  MetricFn,
  MetricInput,
  BandThresholds,
  Band,
  CoherenceReading,
} from "./types.js";
export { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "./types.js";

// Re-export Tick for convenience
export type { Tick } from "./types.js";

// Metric functions (pluggable strategy pattern)
export { computeGoalDrift, goalDriftMetric } from "./metrics/goal-drift.js";
export { computeMemoryRetention, memoryRetentionMetric } from "./metrics/memory-retention.js";
export { computeContradictionPressure, contradictionPressureMetric } from "./metrics/contradiction-pressure.js";
export { computeSemanticDiffusion, semanticDiffusionMetric } from "./metrics/semantic-diffusion.js";
export { computeCoherenceIndex, classifyBand } from "./metrics/coherence-index.js";

// Vector utilities
export { cosineSimilarity, normalize, dot, magnitude, mean, clamp01 } from "./metrics/util.js";

// Sensor
export { createPreExecSensor, DEFAULT_METRICS } from "./sensor.js";
export type { PreExecSensor, PreExecSensorOptions } from "./sensor.js";
