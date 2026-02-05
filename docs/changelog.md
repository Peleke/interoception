# Changelog

## 0.1.0

Initial release.

### Features

- **Pre-execution coherence sensor** — `createPreExecSensor` with pluggable metrics, weights, and thresholds
- **Four built-in metrics** — goal drift, memory retention, contradiction pressure, semantic diffusion
- **MetricFn strategy pattern** — swap, add, or replace metrics
- **ScalarMetricFn** — async scalar metrics with no embedding dependency
- **Metric polarity** — `inverted` flag as single source of truth
- **Band classification** — green/yellow/orange/red with configurable thresholds
- **Pluggable interfaces** — `Embedder` and `StateProvider` (consumer implements)
- **Vector utilities** — `cosineSimilarity`, `dot`, `magnitude`, `normalize`, `mean`, `clamp01`
- **History ring buffer** — configurable size, newest-first retrieval
- **Re-exports `Tick`** from `@peleke.s/cadence` for convenience
