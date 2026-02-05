# Interoception

Coherence sensing for autonomous AI agents.

## Features

- **Pre-execution coherence checks** — measure whether your agent is "thinking straight" before it acts
- **Pluggable metrics** — four built-in metrics plus a strategy pattern for custom ones
- **Band classification** — green/yellow/orange/red coherence bands with configurable thresholds
- **Bring your own embedder** — works with OpenAI, local models, or any embedding provider
- **Zero coupling** — pure measurement tool, no side effects on your signal bus

## Quick Install

```bash
pnpm add @peleke.s/interoception
```

## Quick Example

```typescript
import { createPreExecSensor } from "@peleke.s/interoception";

const sensor = createPreExecSensor({
  embedder: myEmbedder,     // You provide: embed() + embedBatch()
  state: myStateProvider,   // You provide: getGoals(), getRecentContext(), etc.
});

// Wire to a clock tick
const reading = await sensor.measure({ ts: Date.now(), seq: 0 });

console.log(reading.coherenceIndex); // 0.0–1.0
console.log(reading.band);          // "green" | "yellow" | "orange" | "red"
```

## Next Steps

- [Installation](getting-started/installation.md) — setup and prerequisites
- [Quick Start](getting-started/quickstart.md) — measure coherence in 5 minutes
- [Core Concepts](getting-started/concepts.md) — understand the architecture
