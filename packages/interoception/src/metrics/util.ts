/**
 * Vector math utilities for embedding metrics.
 * All functions are pure — no side effects.
 */

/** Compute dot product of two vectors. Vectors must be same length. */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

/** Compute L2 norm (magnitude) of a vector. */
export function magnitude(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/** L2-normalize a vector. Returns zero vector if input is zero. */
export function normalize(v: number[]): number[] {
  const mag = magnitude(v);
  if (mag === 0) return v.map(() => 0);
  return v.map((x) => x / mag);
}

/**
 * Cosine similarity between two vectors.
 * Returns value in [-1, 1]. Returns 0 if either vector is zero.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

/** Clamp a value to [0, 1]. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Mean of an array. Returns 0 for empty arrays. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
