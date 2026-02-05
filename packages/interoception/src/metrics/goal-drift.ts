import type { MetricFn, MetricInput } from "../types.js";
import { cosineSimilarity, mean, clamp01 } from "./util.js";

/**
 * Goal drift: how far the current context has drifted from goals.
 *
 * Method: 1 - mean cosine similarity between goal embeddings and context embeddings.
 * 0 = perfectly aligned, 1 = completely drifted.
 */
export function computeGoalDrift(
  goalEmbeddings: number[][],
  contextEmbeddings: number[][],
): number {
  if (goalEmbeddings.length === 0 || contextEmbeddings.length === 0) return 0;

  // For each context embedding, find its max similarity to any goal
  const sims = contextEmbeddings.map((ctx) => {
    const goalSims = goalEmbeddings.map((goal) => cosineSimilarity(goal, ctx));
    return Math.max(...goalSims);
  });

  return clamp01(1 - mean(sims));
}

/** Goal drift as a pluggable MetricFn. */
export const goalDriftMetric: MetricFn = {
  name: "goalDrift",
  compute(input: MetricInput): number {
    return computeGoalDrift(input.goalEmbeddings, input.contextEmbeddings);
  },
};
