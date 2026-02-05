# Metrics

Interoception ships four built-in metrics that measure different dimensions of agent coherence. All metrics follow the strategy pattern — you can swap, add, or remove them.

## Built-in Metrics

### Goal Drift

**How far the current context has drifted from goals.**

Method: for each context embedding, find its max cosine similarity to any goal embedding. Goal drift = `1 - mean(maxSimilarities)`.

| Property | Value |
|----------|-------|
| Name | `goalDrift` |
| Range | 0 (aligned) to 1 (drifted) |
| Inverted | Yes — higher = less coherent |

```typescript
import { computeGoalDrift, goalDriftMetric } from "@peleke.s/interoception";

// Standalone computation
const drift = computeGoalDrift(goalEmbeddings, contextEmbeddings);

// As a pluggable MetricFn
const metric = goalDriftMetric;
// metric.name === "goalDrift"
// metric.inverted === true
```

### Memory Retention

**How well goal-relevant memories are preserved.**

Method: for each goal embedding, find its max cosine similarity to any goal-relevant memory embedding. Retention = `mean(maxSimilarities)`.

| Property | Value |
|----------|-------|
| Name | `memoryRetention` |
| Range | 0 (forgotten) to 1 (retained) |
| Inverted | No — higher = more coherent |

```typescript
import { computeMemoryRetention, memoryRetentionMetric } from "@peleke.s/interoception";

const retention = computeMemoryRetention(goalEmbeddings, memoryEmbeddings);
```

### Contradiction Pressure

**How much the context contradicts itself.**

Method: pairwise cosine similarity across context embeddings. Count pairs below a threshold (default 0.3) as contradictory. Pressure = `contradictoryPairs / totalPairs`.

| Property | Value |
|----------|-------|
| Name | `contradictionPressure` |
| Range | 0 (coherent) to 1 (contradictory) |
| Inverted | Yes — higher = less coherent |

```typescript
import { computeContradictionPressure, contradictionPressureMetric } from "@peleke.s/interoception";

// With default threshold (0.3)
const pressure = computeContradictionPressure(contextEmbeddings);

// With custom threshold
const pressureCustom = computeContradictionPressure(contextEmbeddings, 0.5);
```

### Semantic Diffusion

**How spread out the context is in embedding space.**

Method: mean pairwise distance (`1 - cosineSimilarity`) across context embeddings.

| Property | Value |
|----------|-------|
| Name | `semanticDiffusion` |
| Range | 0 (focused) to 1 (diffuse) |
| Inverted | Yes — higher = less coherent |

```typescript
import { computeSemanticDiffusion, semanticDiffusionMetric } from "@peleke.s/interoception";

const diffusion = computeSemanticDiffusion(contextEmbeddings);
```

## Edge Cases

All built-in metrics return `0` when inputs are empty or insufficient:

- Empty embedding arrays → `0`
- Single context embedding (for pairwise metrics) → `0`

This ensures the sensor never throws on edge cases.

## MetricFn Interface

```typescript
interface MetricFn {
  name: string;
  inverted?: boolean;
  compute(input: MetricInput): number;
}
```

The `MetricInput` provides all embedding data:

```typescript
interface MetricInput {
  goalEmbeddings: number[][];
  contextEmbeddings: number[][];
  memoryEmbeddings: number[][];
  goalRelevantMemoryEmbeddings: number[][];
}
```

## Writing Custom Metrics

```typescript
import type { MetricFn } from "@peleke.s/interoception";

const focusScore: MetricFn = {
  name: "focusScore",
  inverted: false, // Higher = more focused = more coherent
  compute(input) {
    // Custom logic using input.goalEmbeddings, contextEmbeddings, etc.
    return 0.8;
  },
};
```

Rules for custom metrics:

1. Return a value in [0, 1]
2. Set `inverted: true` if higher values mean less coherent
3. Return 0 when inputs are empty (noop-safe)
4. The `name` becomes the key in `MetricSnapshot`

## ScalarMetricFn Interface

```typescript
interface ScalarMetricFn {
  name: string;
  inverted?: boolean;
  compute(): number | Promise<number>;
}
```

Scalar metrics don't receive embedding data. They close over their own dependencies at construction time and read directly from agent state, databases, APIs, etc.

```typescript
import type { ScalarMetricFn } from "@peleke.s/interoception";

const responseLatency: ScalarMetricFn = {
  name: "responseLatency",
  inverted: true, // High latency = less coherent
  async compute() {
    const latency = await getAverageLatency();
    return Math.min(latency / 5000, 1); // Normalize to [0, 1]
  },
};
```

## Default Metrics

```typescript
import { DEFAULT_METRICS } from "@peleke.s/interoception";
// [goalDriftMetric, memoryRetentionMetric, contradictionPressureMetric, semanticDiffusionMetric]
```

## See Also

- [Coherence Index](coherence-index.md) — how metrics become a single score
- [Sensor](sensor.md) — wiring metrics into the sensor
- [Types Reference](../reference/types.md#metricfn) — `MetricFn`, `ScalarMetricFn`, `MetricInput`
