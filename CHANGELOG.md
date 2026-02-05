# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2026-02-05

### Features

- **Pre-execution coherence sensor** — `createPreExecSensor` orchestrates the full sensing pipeline
- **Four built-in metrics** — goal drift, memory retention, contradiction pressure, semantic diffusion
- **MetricFn strategy pattern** — swap, add, or replace metrics via pluggable interface
- **ScalarMetricFn** — async scalar metrics that read directly from agent state (no embeddings)
- **Metric polarity** — `inverted` flag on MetricFn/ScalarMetricFn declares whether higher = less coherent
- **Coherence index** — weighted aggregation with configurable `invertedMetrics` parameter
- **Band classification** — green/yellow/orange/red with configurable thresholds
- **Pluggable interfaces** — `Embedder` and `StateProvider` (consumer implements)
- **Vector utilities** — `cosineSimilarity`, `dot`, `magnitude`, `normalize`, `mean`, `clamp01`
- **History ring buffer** — configurable size, newest-first retrieval
- **Re-exports `Tick`** from `@peleke.s/cadence` for convenience

### Testing

- 105 tests: unit + integration + property (fast-check) + metamorphic
- Backwards compatibility verified across all changes
