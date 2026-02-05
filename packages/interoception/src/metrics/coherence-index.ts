import type {
  MetricSnapshot,
  MetricWeights,
  Band,
  BandThresholds,
} from "../types.js";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS } from "../types.js";
import { clamp01 } from "./util.js";

/**
 * Compute the coherence index from a metric snapshot.
 *
 * The coherence index inverts "bad" metrics (goalDrift, contradictionPressure,
 * semanticDiffusion are 0=good, 1=bad) and keeps "good" metrics (memoryRetention
 * is 0=bad, 1=good).
 *
 * Result: 0 = incoherent, 1 = coherent.
 */
export function computeCoherenceIndex(
  metrics: MetricSnapshot,
  weights: MetricWeights = DEFAULT_WEIGHTS,
): number {
  // Metrics where higher = worse (invert them for coherence)
  const invertedMetrics = new Set([
    "goalDrift",
    "contradictionPressure",
    "semanticDiffusion",
  ]);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (weight === undefined || weight === 0) continue;
    const value = metrics[key];
    if (value === undefined) continue;

    const coherenceValue = invertedMetrics.has(key) ? 1 - value : value;
    weightedSum += coherenceValue * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 1; // No metrics = assume coherent
  return clamp01(weightedSum / totalWeight);
}

/**
 * Classify a coherence index into a band.
 *
 * green >= 0.8, yellow >= 0.6, orange >= 0.4, red < 0.4
 */
export function classifyBand(
  coherenceIndex: number,
  thresholds: BandThresholds = DEFAULT_THRESHOLDS,
): Band {
  if (coherenceIndex >= thresholds.green) return "green";
  if (coherenceIndex >= thresholds.yellow) return "yellow";
  if (coherenceIndex >= thresholds.orange) return "orange";
  return "red";
}
