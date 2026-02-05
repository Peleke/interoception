import type { MetricFn, MetricInput } from "../types.js";
import { cosineSimilarity, mean, clamp01 } from "./util.js";

/**
 * Semantic diffusion: how spread out the context is in embedding space.
 *
 * Method: normalized mean pairwise distance (1 - similarity).
 * 0 = highly focused (all context points to same thing), 1 = diffuse.
 */
export function computeSemanticDiffusion(
  contextEmbeddings: number[][],
): number {
  const n = contextEmbeddings.length;
  if (n < 2) return 0;

  const distances: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(contextEmbeddings[i]!, contextEmbeddings[j]!);
      distances.push(1 - sim);
    }
  }

  return clamp01(mean(distances));
}

/** Semantic diffusion as a pluggable MetricFn. */
export const semanticDiffusionMetric: MetricFn = {
  name: "semanticDiffusion",
  compute(input: MetricInput): number {
    return computeSemanticDiffusion(input.contextEmbeddings);
  },
};
