# Coherence Sensor

The `createPreExecSensor` factory is the heart of interoception. It orchestrates the full sensing pipeline: state gathering, embedding, metric computation, and coherence classification.

## Basic Usage

```typescript
import { createPreExecSensor } from "@peleke.s/interoception";

const sensor = createPreExecSensor({
  embedder: myEmbedder,
  state: myStateProvider,
});

const reading = await sensor.measure({ ts: Date.now(), seq: 1 });
console.log(reading.band); // "green" | "yellow" | "orange" | "red"
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `embedder` | `Embedder` | — | Embedding provider (required) |
| `state` | `StateProvider` | — | Agent state provider (required) |
| `metrics` | `MetricFn[]` | `DEFAULT_METRICS` | Embedding-based metrics |
| `scalarMetrics` | `ScalarMetricFn[]` | `[]` | Scalar metrics (no embeddings) |
| `weights` | `MetricWeights` | `DEFAULT_WEIGHTS` | Weights for coherence index |
| `thresholds` | `BandThresholds` | `DEFAULT_THRESHOLDS` | Band classification thresholds |
| `onReading` | `(reading: CoherenceReading) => void \| Promise<void>` | — | Callback after each reading |
| `historySize` | `number` | `100` | Max readings in the history ring buffer |

## PreExecSensor Interface

```typescript
interface PreExecSensor {
  measure(tick: Tick): Promise<CoherenceReading>;
  history(n?: number): CoherenceReading[];
}
```

- `measure(tick)` — take a single coherence measurement at this tick
- `history(n?)` — get the N most recent readings, newest first. Omit N for all readings.

## Wiring to a Clock

The sensor expects a `Tick` from Cadence's clock system:

```typescript
import { createIntervalClock, createClockSource } from "@peleke.s/cadence";

const clock = createIntervalClock({ intervalMs: 30_000 });

// Option 1: Direct clock usage
clock.start(async (tick) => {
  const reading = await sensor.measure(tick);
  if (reading.band === "red") {
    console.warn("Coherence critical — consider re-planning");
  }
});

// Option 2: Via ClockSource adapter (bridges into signal bus)
const source = createClockSource({
  clock,
  toSignal: (tick) => ({
    type: "coherence.check",
    ts: tick.ts,
    id: crypto.randomUUID(),
    payload: { seq: tick.seq },
  }),
});
```

## Custom Metrics

Replace or extend the default metrics:

```typescript
import {
  createPreExecSensor,
  goalDriftMetric,
  memoryRetentionMetric,
  type MetricFn,
} from "@peleke.s/interoception";

const myCustomMetric: MetricFn = {
  name: "taskProgress",
  inverted: false, // Higher = more coherent
  compute(input) {
    // Your custom logic using embeddings
    return 0.75;
  },
};

const sensor = createPreExecSensor({
  embedder,
  state,
  metrics: [goalDriftMetric, memoryRetentionMetric, myCustomMetric],
  weights: {
    goalDrift: 0.3,
    memoryRetention: 0.3,
    taskProgress: 0.4,
  },
});
```

## Scalar Metrics

Add metrics that don't need embeddings:

```typescript
import type { ScalarMetricFn } from "@peleke.s/interoception";

const tokenBudget: ScalarMetricFn = {
  name: "tokenBudget",
  inverted: true, // High usage = less coherent
  async compute() {
    const usage = await getTokenUsage();
    return usage / maxTokens; // 0–1
  },
};

const sensor = createPreExecSensor({
  embedder,
  state,
  scalarMetrics: [tokenBudget],
  weights: {
    goalDrift: 0.2,
    memoryRetention: 0.2,
    contradictionPressure: 0.2,
    semanticDiffusion: 0.2,
    tokenBudget: 0.2,
  },
});
```

## Reading History

The sensor maintains a ring buffer of recent readings:

```typescript
// Get last 5 readings (newest first)
const recent = sensor.history(5);

// Get all readings
const all = sensor.history();

// Track trends
const trending = recent.map((r) => r.coherenceIndex);
const isDecreasing = trending[0]! < trending[trending.length - 1]!;
```

## Lifecycle

The sensor is stateless beyond its ring buffer. It does not:

- Start or stop anything (it's not a Source)
- Emit signals (it's a measurement tool)
- Modify agent state (it's read-only)

The consumer is responsible for wiring the sensor to a clock and deciding what to do with readings.

## See Also

- [Metrics](metrics.md) — built-in metrics and how they work
- [Coherence Index](coherence-index.md) — how the index is computed
- [Pluggable Interfaces](pluggable-interfaces.md) — implementing Embedder and StateProvider
- [Types Reference](../reference/types.md#preexecsensoroptions) — `PreExecSensorOptions` definition
