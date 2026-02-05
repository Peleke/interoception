# Pluggable Interfaces

Interoception follows Cadence's philosophy: build for sophistication, implement simple. The two main interfaces you need to implement are `Embedder` and `StateProvider`.

## Embedder

```typescript
interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

The embedder converts text to vectors. The sensor calls `embedBatch` for efficiency — it deduplicates all texts before embedding.

### OpenAI Example

```typescript
import type { Embedder } from "@peleke.s/interoception";
import OpenAI from "openai";

function createOpenAIEmbedder(model = "text-embedding-3-small"): Embedder {
  const client = new OpenAI();
  return {
    dimensions: 1536,
    async embed(text) {
      const res = await client.embeddings.create({ model, input: text });
      return res.data[0]!.embedding;
    },
    async embedBatch(texts) {
      const res = await client.embeddings.create({ model, input: texts });
      return res.data.map((d) => d.embedding);
    },
  };
}
```

### Test/Stub Embedder

For testing, use a deterministic embedder:

```typescript
const stubEmbedder: Embedder = {
  dimensions: 3,
  async embed(text) {
    // Simple hash-based deterministic embedding
    const hash = [...text].reduce((h, c) => h + c.charCodeAt(0), 0);
    return [Math.sin(hash), Math.cos(hash), Math.sin(hash * 2)];
  },
  async embedBatch(texts) {
    return Promise.all(texts.map((t) => this.embed(t)));
  },
};
```

## StateProvider

```typescript
interface StateProvider {
  getGoals(): Promise<string[]>;
  getRecentContext(): Promise<string[]>;
  getGoalRelevantMemories(): Promise<string[]>;
  getAllMemories(): Promise<string[]>;
}
```

The state provider exposes your agent's internal state. Each method returns an array of strings that the sensor will embed.

### What Each Method Provides

| Method | Returns | Used By |
|--------|---------|---------|
| `getGoals()` | Current goals/objectives | Goal drift, Memory retention |
| `getRecentContext()` | Recent conversation, observations | Goal drift, Contradiction pressure, Semantic diffusion |
| `getGoalRelevantMemories()` | Memories relevant to current goals | Memory retention |
| `getAllMemories()` | All available memories | (Available in MetricInput) |

### Implementation Tips

- **Return meaningful strings**: the quality of coherence readings depends on the quality of state text
- **Keep it current**: return the agent's _current_ state, not historical state
- **Be selective**: return the most relevant items, not everything. 5-20 items per method is typical
- **Async is fine**: all methods are async — query databases, APIs, or caches as needed

### Example with a Memory Store

```typescript
import type { StateProvider } from "@peleke.s/interoception";

function createStateProvider(agent: MyAgent): StateProvider {
  return {
    async getGoals() {
      return agent.activeGoals.map((g) => g.description);
    },
    async getRecentContext() {
      const turns = await agent.conversation.getRecent(10);
      return turns.map((t) => t.content);
    },
    async getGoalRelevantMemories() {
      const goals = agent.activeGoals.map((g) => g.description);
      return agent.memory.searchByRelevance(goals, 10);
    },
    async getAllMemories() {
      return agent.memory.getAll();
    },
  };
}
```

## Design Principles

Both interfaces follow the same pattern:

- **Consumer implements** — interoception defines the shape, your code fills it in
- **Async by default** — real implementations will hit APIs, databases, or models
- **No defaults** — there's no "default embedder" because the right choice depends on your use case
- **Composable** — wrap, cache, or layer implementations as needed

## See Also

- [Sensor](sensor.md) — how the sensor uses these interfaces
- [Quick Start](../getting-started/quickstart.md) — minimal implementations
- [Types Reference](../reference/types.md#embedder) — `Embedder`, `StateProvider` definitions
