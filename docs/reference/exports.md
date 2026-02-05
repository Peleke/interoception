# API Exports

Everything exported from `@peleke.s/interoception`:

```typescript
import {
  // Sensor
  createPreExecSensor,
  DEFAULT_METRICS,

  // Metric functions
  computeGoalDrift,
  goalDriftMetric,
  computeMemoryRetention,
  memoryRetentionMetric,
  computeContradictionPressure,
  contradictionPressureMetric,
  computeSemanticDiffusion,
  semanticDiffusionMetric,

  // Coherence index
  computeCoherenceIndex,
  classifyBand,

  // Constants
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,

  // Vector utilities
  cosineSimilarity,
  normalize,
  dot,
  magnitude,
  mean,
  clamp01,
} from "@peleke.s/interoception";
```

## Functions

| Function | Module | Description |
|----------|--------|-------------|
| `createPreExecSensor(options)` | sensor | Create a coherence sensor |
| `computeGoalDrift(goalEmbeddings, contextEmbeddings)` | metrics | Compute goal drift score |
| `computeMemoryRetention(goalEmbeddings, memoryEmbeddings)` | metrics | Compute memory retention score |
| `computeContradictionPressure(contextEmbeddings, threshold?)` | metrics | Compute contradiction pressure |
| `computeSemanticDiffusion(contextEmbeddings)` | metrics | Compute semantic diffusion |
| `computeCoherenceIndex(metrics, weights?)` | metrics | Compute weighted coherence index |
| `classifyBand(coherenceIndex, thresholds?)` | metrics | Classify index into a band |
| `cosineSimilarity(a, b)` | util | Cosine similarity between vectors |
| `dot(a, b)` | util | Dot product of two vectors |
| `magnitude(v)` | util | L2 norm of a vector |
| `normalize(v)` | util | L2-normalize a vector |
| `mean(values)` | util | Arithmetic mean |
| `clamp01(v)` | util | Clamp value to [0, 1] |

## Constants

| Constant | Type | Description |
|----------|------|-------------|
| `DEFAULT_METRICS` | `MetricFn[]` | The four core metric functions |
| `DEFAULT_WEIGHTS` | `MetricWeights` | Equal weights (0.25 each) |
| `DEFAULT_THRESHOLDS` | `BandThresholds` | `{ green: 0.8, yellow: 0.6, orange: 0.4 }` |

## Metric Instances

| Instance | Type | Description |
|----------|------|-------------|
| `goalDriftMetric` | `MetricFn` | Goal drift as a pluggable metric |
| `memoryRetentionMetric` | `MetricFn` | Memory retention as a pluggable metric |
| `contradictionPressureMetric` | `MetricFn` | Contradiction pressure as a pluggable metric |
| `semanticDiffusionMetric` | `MetricFn` | Semantic diffusion as a pluggable metric |

## Types

| Type | Module | Description |
|------|--------|-------------|
| `Embedder` | types | Pluggable embedding interface |
| `StateProvider` | types | Pluggable agent state access |
| `MetricFn` | types | Metric strategy pattern |
| `MetricInput` | types | Input data for metric functions |
| `MetricSnapshot` | types | All metric values |
| `MetricWeights` | types | Weights for coherence index |
| `BandThresholds` | types | Band classification thresholds |
| `Band` | types | `"green" \| "yellow" \| "orange" \| "red"` |
| `CoherenceReading` | types | Single coherence measurement |
| `PreExecSensor` | sensor | Sensor interface |
| `PreExecSensorOptions` | sensor | Sensor configuration |
| `Tick` | types (re-export) | Clock tick from `@peleke.s/cadence` |
