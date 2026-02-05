import type { MetricFn, MetricInput } from "../types.js";
import { cosineSimilarity, mean, clamp01 } from "./util.js";

/**
 * Memory retention: how well goal-relevant memories are preserved.
 *
 * Method: for each goal, find the max similarity to any memory.
 * Mean of these max similarities = retention score.
 * 0 = forgotten everything, 1 = fully retained.
 */
export function computeMemoryRetention(
  goalEmbeddings: number[][],
  memoryEmbeddings: number[][],
): number {
  if (goalEmbeddings.length === 0 || memoryEmbeddings.length === 0) return 0;

  const retentions = goalEmbeddings.map((goal) => {
    const sims = memoryEmbeddings.map((mem) => cosineSimilarity(goal, mem));
    return Math.max(...sims);
  });

  return clamp01(mean(retentions));
}

/** Memory retention as a pluggable MetricFn. */
export const memoryRetentionMetric: MetricFn = {
  name: "memoryRetention",
  compute(input: MetricInput): number {
    return computeMemoryRetention(
      input.goalEmbeddings,
      input.goalRelevantMemoryEmbeddings,
    );
  },
};
