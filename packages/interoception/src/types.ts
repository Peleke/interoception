/**
 * Core types for the interoception package.
 *
 * Interoception = internal sensing. This package measures agent coherence
 * by embedding goals, context, and memories, then computing metrics.
 */

// Re-export Tick so consumers don't need to import cadence directly
export type { Tick } from "@peleke.s/cadence";

// ---------------------------------------------------------------------------
// Embedder — pluggable, consumer provides implementation
// ---------------------------------------------------------------------------

/** Pluggable embedding interface. Consumer provides the implementation (OpenAI, local model, etc.) */
export interface Embedder {
  /** Embed a single text into a vector. */
  embed(text: string): Promise<number[]>;
  /** Embed multiple texts. May batch for efficiency. */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Dimensionality of the embedding vectors. */
  readonly dimensions: number;
}

// ---------------------------------------------------------------------------
// StateProvider — consumer provides access to agent state
// ---------------------------------------------------------------------------

/** Pluggable access to the agent's current state. Consumer implements this. */
export interface StateProvider {
  /** Current goals the agent is pursuing. */
  getGoals(): Promise<string[]>;
  /** Recent context (conversation turns, observations, etc.) */
  getRecentContext(): Promise<string[]>;
  /** Memories that are relevant to current goals. */
  getGoalRelevantMemories(): Promise<string[]>;
  /** All available memories. */
  getAllMemories(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Metric types — pluggable via MetricFn strategy
// ---------------------------------------------------------------------------

/** Snapshot of all coherence metrics, each normalized to [0, 1]. */
export interface MetricSnapshot {
  /** 0 = aligned with goals, 1 = drifted away */
  goalDrift: number;
  /** 0 = forgotten everything, 1 = fully retained */
  memoryRetention: number;
  /** 0 = internally coherent, 1 = contradictory */
  contradictionPressure: number;
  /** 0 = focused, 1 = semantically diffuse */
  semanticDiffusion: number;
  /** Additional custom metrics. Strategy pattern — consumers can add their own. */
  [key: string]: number;
}

/** Weights for computing the coherence index from metrics. */
export interface MetricWeights {
  goalDrift?: number;
  memoryRetention?: number;
  contradictionPressure?: number;
  semanticDiffusion?: number;
  /** Weights for custom metrics. */
  [key: string]: number | undefined;
}

/** Default weights: equal across the four core metrics. */
export const DEFAULT_WEIGHTS: Required<Pick<MetricWeights, "goalDrift" | "memoryRetention" | "contradictionPressure" | "semanticDiffusion">> = {
  goalDrift: 0.25,
  memoryRetention: 0.25,
  contradictionPressure: 0.25,
  semanticDiffusion: 0.25,
};

/** Band thresholds for classifying coherence index. */
export interface BandThresholds {
  green: number;  // >= this is green
  yellow: number; // >= this is yellow
  orange: number; // >= this is orange
  // Below orange = red
}

/** Default band thresholds. */
export const DEFAULT_THRESHOLDS: BandThresholds = {
  green: 0.8,
  yellow: 0.6,
  orange: 0.4,
};

/** Coherence band classification. */
export type Band = "green" | "yellow" | "orange" | "red";

// ---------------------------------------------------------------------------
// Pluggable metric strategy
// ---------------------------------------------------------------------------

/** Input data available to metric functions. */
export interface MetricInput {
  goalEmbeddings: number[][];
  contextEmbeddings: number[][];
  memoryEmbeddings: number[][];
  goalRelevantMemoryEmbeddings: number[][];
}

/**
 * A single metric function. Strategy pattern — consumers can swap, add, or replace metrics.
 *
 * Each MetricFn receives the embedding data and returns a value in [0, 1].
 * The name is used as the key in MetricSnapshot.
 */
export interface MetricFn {
  /** Metric name, used as key in MetricSnapshot. */
  name: string;
  /** If true, higher values = less coherent (inverted during index computation). */
  inverted?: boolean;
  /** Compute the metric value from embeddings. Must return a value in [0, 1]. */
  compute(input: MetricInput): number;
}

/**
 * A scalar metric that reads directly from agent state (no embeddings).
 * Async because it may query databases, APIs, etc.
 * Closes over its own dependencies at construction time.
 * Returns a value in [0, 1]. Must noop (return 0) if its data source is unavailable.
 */
export interface ScalarMetricFn {
  /** Metric name, used as key in MetricSnapshot. */
  name: string;
  /** If true, higher values = less coherent (inverted during index computation). */
  inverted?: boolean;
  /** Compute the metric value. Must return a value in [0, 1]. */
  compute(): number | Promise<number>;
}

// ---------------------------------------------------------------------------
// CoherenceReading — output of the sensor
// ---------------------------------------------------------------------------

/** A single coherence measurement at a point in time. */
export interface CoherenceReading {
  /** Timestamp when this reading was taken. */
  ts: number;
  /** Tick sequence number from the clock. */
  tickSeq: number;
  /** All metric values. */
  metrics: MetricSnapshot;
  /** Weighted coherence index (0 = incoherent, 1 = coherent). */
  coherenceIndex: number;
  /** Band classification. */
  band: Band;
}
