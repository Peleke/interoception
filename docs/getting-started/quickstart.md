# Quick Start

Measure your agent's coherence in under 5 minutes.

## Step 1: Implement the Embedder

The embedder converts text to vectors. Wrap your embedding provider (OpenAI, local model, etc.):

```typescript
import type { Embedder } from "@peleke.s/interoception";

const embedder: Embedder = {
  dimensions: 1536,
  async embed(text: string): Promise<number[]> {
    // Call your embedding API
    return await myEmbeddingApi.embed(text);
  },
  async embedBatch(texts: string[]): Promise<number[][]> {
    return await myEmbeddingApi.embedBatch(texts);
  },
};
```

## Step 2: Implement the StateProvider

The state provider gives the sensor access to your agent's current state:

```typescript
import type { StateProvider } from "@peleke.s/interoception";

const state: StateProvider = {
  async getGoals() {
    return ["Summarize the quarterly report", "Identify key trends"];
  },
  async getRecentContext() {
    return ["User asked about Q3 revenue", "Found 3 relevant documents"];
  },
  async getGoalRelevantMemories() {
    return ["Q2 report showed 15% growth"];
  },
  async getAllMemories() {
    return ["Q2 report showed 15% growth", "Company founded in 2019"];
  },
};
```

## Step 3: Create the Sensor and Measure

```typescript
import { createPreExecSensor } from "@peleke.s/interoception";

const sensor = createPreExecSensor({ embedder, state });

// Take a reading (pass a Tick from your clock)
const reading = await sensor.measure({ ts: Date.now(), seq: 1 });

console.log(reading.coherenceIndex); // 0.85
console.log(reading.band);          // "green"
console.log(reading.metrics);       // { goalDrift, memoryRetention, ... }
```

## Complete Example

```typescript
import type { Embedder, StateProvider } from "@peleke.s/interoception";
import { createPreExecSensor } from "@peleke.s/interoception";

// 1. Embedder — wraps your embedding provider
const embedder: Embedder = {
  dimensions: 1536,
  async embed(text) { return myApi.embed(text); },
  async embedBatch(texts) { return myApi.embedBatch(texts); },
};

// 2. StateProvider — exposes agent state
const state: StateProvider = {
  async getGoals() { return ["Summarize quarterly report"]; },
  async getRecentContext() { return ["Reviewing Q3 data"]; },
  async getGoalRelevantMemories() { return ["Q2 showed growth"]; },
  async getAllMemories() { return ["Q2 showed growth", "Founded 2019"]; },
};

// 3. Create sensor and measure
const sensor = createPreExecSensor({ embedder, state });
const reading = await sensor.measure({ ts: Date.now(), seq: 1 });

if (reading.band === "red") {
  console.warn("Agent coherence is low — consider re-planning");
}
```

## What's Next?

- [Core Concepts](concepts.md) — understand the sensing pipeline
- [Sensor Guide](../guides/sensor.md) — deep dive into `createPreExecSensor`
- [Metrics Guide](../guides/metrics.md) — built-in metrics and custom strategies
