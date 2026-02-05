# Coherence Index

The coherence index aggregates all metric values into a single score between 0 (incoherent) and 1 (coherent). Band classification maps this score to an actionable label.

!!! note "Experimental"
    The coherence index formula is a starting point, not a final answer. The weights, thresholds, and aggregation method are all designed to be tuned. Part of the value is simply having something to measure — expect the formula to evolve as real-world usage reveals what matters.

## Basic Usage

```typescript
import { computeCoherenceIndex, classifyBand } from "@peleke.s/interoception";

const metrics = {
  goalDrift: 0.2,
  memoryRetention: 0.9,
  contradictionPressure: 0.1,
  semanticDiffusion: 0.15,
};

const invertedMetrics = new Set(["goalDrift", "contradictionPressure", "semanticDiffusion"]);

const index = computeCoherenceIndex(metrics, undefined, invertedMetrics);
const band = classifyBand(index);

console.log(index); // ~0.86
console.log(band);  // "green"
```

## How It Works

### Polarity Handling

Metrics have different polarities:

- **Not inverted** (e.g., `memoryRetention`): higher value = more coherent → used as-is
- **Inverted** (e.g., `goalDrift`): higher value = less coherent → flipped to `1 - value`

The sensor builds the inverted set automatically from each metric's `inverted` flag. When calling `computeCoherenceIndex` directly, you pass the inverted set as the third parameter (defaults to empty set).

### Weighted Sum

```
coherenceIndex = Σ(coherenceValue × weight) / Σ(weight)
```

Where `coherenceValue` is the raw metric value (not inverted) or `1 - value` (inverted).

### Default Weights

```typescript
import { DEFAULT_WEIGHTS } from "@peleke.s/interoception";
// {
//   goalDrift: 0.25,
//   memoryRetention: 0.25,
//   contradictionPressure: 0.25,
//   semanticDiffusion: 0.25,
// }
```

Equal weight across all four core metrics. Custom metrics get weight 0 unless you specify them.

## Configuration

### Custom Weights

```typescript
const sensor = createPreExecSensor({
  embedder,
  state,
  weights: {
    goalDrift: 0.4,        // Prioritize goal alignment
    memoryRetention: 0.3,
    contradictionPressure: 0.2,
    semanticDiffusion: 0.1,
  },
});
```

Weights don't need to sum to 1 — they're normalized during computation.

### Custom Thresholds

```typescript
import type { BandThresholds } from "@peleke.s/interoception";

const strictThresholds: BandThresholds = {
  green: 0.9,   // >= 0.9 is green
  yellow: 0.75, // >= 0.75 is yellow
  orange: 0.5,  // >= 0.5 is orange
  // Below 0.5 = red
};

const sensor = createPreExecSensor({
  embedder,
  state,
  thresholds: strictThresholds,
});
```

## Band Classification

```typescript
import { DEFAULT_THRESHOLDS } from "@peleke.s/interoception";
// { green: 0.8, yellow: 0.6, orange: 0.4 }
```

| Band | Threshold | Meaning |
|------|-----------|---------|
| `green` | >= 0.8 | Coherent — proceed normally |
| `yellow` | >= 0.6 | Slightly off — monitor |
| `orange` | >= 0.4 | Drifting — consider re-planning |
| `red` | < 0.4 | Incoherent — pause and intervene |

```typescript
import { classifyBand, DEFAULT_THRESHOLDS } from "@peleke.s/interoception";

classifyBand(0.85); // "green"
classifyBand(0.65); // "yellow"
classifyBand(0.45); // "orange"
classifyBand(0.35); // "red"
```

## Edge Cases

- **No metrics**: if all weights are 0 or no metrics are provided, returns `1` (assume coherent)
- **Missing metric**: if a weight references a metric not in the snapshot, it's skipped
- **Result clamping**: output is always clamped to [0, 1]

## Function Signatures

```typescript
function computeCoherenceIndex(
  metrics: MetricSnapshot,
  weights?: MetricWeights,
  invertedMetrics?: ReadonlySet<string>,
): number;

function classifyBand(
  coherenceIndex: number,
  thresholds?: BandThresholds,
): Band;
```

## See Also

- [Metrics](metrics.md) — the four built-in metrics
- [Sensor](sensor.md) — how the sensor computes the index automatically
- [Types Reference](../reference/types.md#bandthresholds) — `BandThresholds`, `Band`, `MetricWeights`
