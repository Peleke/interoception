# Type Reference

## Pluggable Interfaces

### `Embedder`

Pluggable embedding interface. Consumer provides the implementation.

```typescript
interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `embed` | `(text: string) => Promise<number[]>` | Embed a single text into a vector |
| `embedBatch` | `(texts: string[]) => Promise<number[][]>` | Embed multiple texts (may batch) |
| `dimensions` | `number` | Dimensionality of embedding vectors |

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions)

### `StateProvider`

Pluggable access to the agent's current state.

```typescript
interface StateProvider {
  getGoals(): Promise<string[]>;
  getRecentContext(): Promise<string[]>;
  getGoalRelevantMemories(): Promise<string[]>;
  getAllMemories(): Promise<string[]>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `getGoals` | `() => Promise<string[]>` | Current goals the agent is pursuing |
| `getRecentContext` | `() => Promise<string[]>` | Recent conversation turns, observations |
| `getGoalRelevantMemories` | `() => Promise<string[]>` | Memories relevant to current goals |
| `getAllMemories` | `() => Promise<string[]>` | All available memories |

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions)

## Metric Types

### `MetricFn`

A single metric function. Strategy pattern — consumers can swap, add, or replace metrics.

```typescript
interface MetricFn {
  name: string;
  inverted?: boolean;
  compute(input: MetricInput): number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Metric name, used as key in `MetricSnapshot` |
| `inverted` | `boolean \| undefined` | If true, higher values = less coherent |
| `compute` | `(input: MetricInput) => number` | Compute metric value in [0, 1] |

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions)

### `ScalarMetricFn`

A scalar metric that reads directly from agent state (no embeddings).

```typescript
interface ScalarMetricFn {
  name: string;
  inverted?: boolean;
  compute(): number | Promise<number>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Metric name, used as key in `MetricSnapshot` |
| `inverted` | `boolean \| undefined` | If true, higher values = less coherent |
| `compute` | `() => number \| Promise<number>` | Compute metric value in [0, 1] |

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions)

### `MetricInput`

Input data available to metric functions.

```typescript
interface MetricInput {
  goalEmbeddings: number[][];
  contextEmbeddings: number[][];
  memoryEmbeddings: number[][];
  goalRelevantMemoryEmbeddings: number[][];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `goalEmbeddings` | `number[][]` | Embedded goals |
| `contextEmbeddings` | `number[][]` | Embedded recent context |
| `memoryEmbeddings` | `number[][]` | Embedded all memories |
| `goalRelevantMemoryEmbeddings` | `number[][]` | Embedded goal-relevant memories |

**Used by:** [`MetricFn`](#metricfn)

### `MetricSnapshot`

Snapshot of all coherence metrics, each normalized to [0, 1].

```typescript
interface MetricSnapshot {
  goalDrift: number;
  memoryRetention: number;
  contradictionPressure: number;
  semanticDiffusion: number;
  [key: string]: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `goalDrift` | `number` | 0 = aligned, 1 = drifted |
| `memoryRetention` | `number` | 0 = forgotten, 1 = retained |
| `contradictionPressure` | `number` | 0 = coherent, 1 = contradictory |
| `semanticDiffusion` | `number` | 0 = focused, 1 = diffuse |
| `[key: string]` | `number` | Additional custom metrics |

**Used by:** [`CoherenceReading`](#coherencereading), [`computeCoherenceIndex`](exports.md)

### `MetricWeights`

Weights for computing the coherence index from metrics.

```typescript
interface MetricWeights {
  goalDrift?: number;
  memoryRetention?: number;
  contradictionPressure?: number;
  semanticDiffusion?: number;
  [key: string]: number | undefined;
}
```

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions), [`computeCoherenceIndex`](exports.md)

## Band Types

### `BandThresholds`

Band thresholds for classifying coherence index.

```typescript
interface BandThresholds {
  green: number;
  yellow: number;
  orange: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `green` | `number` | >= this is green (default: 0.8) |
| `yellow` | `number` | >= this is yellow (default: 0.6) |
| `orange` | `number` | >= this is orange (default: 0.4) |

**Used by:** [`PreExecSensorOptions`](#preexecsensoroptions), [`classifyBand`](exports.md)

### `Band`

Coherence band classification.

```typescript
type Band = "green" | "yellow" | "orange" | "red";
```

**Used by:** [`CoherenceReading`](#coherencereading)

## Sensor Types

### `CoherenceReading`

A single coherence measurement at a point in time.

```typescript
interface CoherenceReading {
  ts: number;
  tickSeq: number;
  metrics: MetricSnapshot;
  coherenceIndex: number;
  band: Band;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `ts` | `number` | Timestamp when this reading was taken |
| `tickSeq` | `number` | Tick sequence number from the clock |
| `metrics` | `MetricSnapshot` | All metric values |
| `coherenceIndex` | `number` | Weighted coherence index (0–1) |
| `band` | `Band` | Band classification |

**Used by:** [`PreExecSensor`](#preexecsensor)

### `PreExecSensor`

PreExec sensor interface.

```typescript
interface PreExecSensor {
  measure(tick: Tick): Promise<CoherenceReading>;
  history(n?: number): CoherenceReading[];
}
```

| Property | Type | Description |
|----------|------|-------------|
| `measure` | `(tick: Tick) => Promise<CoherenceReading>` | Take a coherence measurement |
| `history` | `(n?: number) => CoherenceReading[]` | Get N most recent readings (newest first) |

**Used by:** [`createPreExecSensor`](exports.md)

### `PreExecSensorOptions`

Options for creating a PreExec sensor.

```typescript
interface PreExecSensorOptions {
  embedder: Embedder;
  state: StateProvider;
  metrics?: MetricFn[];
  scalarMetrics?: ScalarMetricFn[];
  weights?: MetricWeights;
  thresholds?: BandThresholds;
  onReading?: (reading: CoherenceReading) => void | Promise<void>;
  historySize?: number;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `embedder` | `Embedder` | — | Embedding provider |
| `state` | `StateProvider` | — | Agent state provider |
| `metrics` | `MetricFn[]` | `DEFAULT_METRICS` | Embedding-based metrics |
| `scalarMetrics` | `ScalarMetricFn[]` | `[]` | Scalar metrics |
| `weights` | `MetricWeights` | `DEFAULT_WEIGHTS` | Coherence index weights |
| `thresholds` | `BandThresholds` | `DEFAULT_THRESHOLDS` | Band thresholds |
| `onReading` | `(reading: CoherenceReading) => void \| Promise<void>` | — | Post-reading callback |
| `historySize` | `number` | `100` | Ring buffer size |

## Re-exported Types

### `Tick`

Re-exported from `@peleke.s/cadence` for convenience.

```typescript
interface Tick {
  ts: number;
  seq: number;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `ts` | `number` | Timestamp |
| `seq` | `number` | Sequence number |

**Used by:** [`PreExecSensor.measure`](#preexecsensor)
