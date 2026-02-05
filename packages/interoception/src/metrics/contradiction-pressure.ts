import type { MetricFn, MetricInput } from "../types.js";
import { cosineSimilarity, clamp01 } from "./util.js";

/**
 * Contradiction pressure: how much the context contradicts itself.
 *
 * Method: pairwise cosine similarity, ratio of low-similarity pairs.
 * A pair with similarity below the threshold is considered contradictory.
 * 0 = internally coherent, 1 = high contradiction.
 */
export function computeContradictionPressure(
  contextEmbeddings: number[][],
  threshold = 0.3,
): number {
  const n = contextEmbeddings.length;
  if (n < 2) return 0;

  let totalPairs = 0;
  let lowSimPairs = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalPairs++;
      const sim = cosineSimilarity(contextEmbeddings[i]!, contextEmbeddings[j]!);
      if (sim < threshold) {
        lowSimPairs++;
      }
    }
  }

  return clamp01(lowSimPairs / totalPairs);
}

/** Contradiction pressure as a pluggable MetricFn. */
export const contradictionPressureMetric: MetricFn = {
  name: "contradictionPressure",
  inverted: true,
  compute(input: MetricInput): number {
    return computeContradictionPressure(input.contextEmbeddings);
  },
};
