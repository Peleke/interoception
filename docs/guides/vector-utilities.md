# Vector Utilities

Interoception exports its vector math utilities for use in custom metrics or standalone computation. All functions are pure — no side effects.

## Functions

### `cosineSimilarity(a, b)`

Cosine similarity between two vectors. Returns a value in [-1, 1]. Returns 0 if either vector is zero.

```typescript
import { cosineSimilarity } from "@peleke.s/interoception";

cosineSimilarity([1, 0], [0, 1]); // 0 (orthogonal)
cosineSimilarity([1, 0], [1, 0]); // 1 (identical)
cosineSimilarity([1, 0], [-1, 0]); // -1 (opposite)
```

### `dot(a, b)`

Dot product of two vectors. Throws if lengths differ.

```typescript
import { dot } from "@peleke.s/interoception";

dot([1, 2, 3], [4, 5, 6]); // 32
```

### `magnitude(v)`

L2 norm (Euclidean length) of a vector.

```typescript
import { magnitude } from "@peleke.s/interoception";

magnitude([3, 4]); // 5
```

### `normalize(v)`

L2-normalize a vector. Returns a zero vector if input is zero.

```typescript
import { normalize } from "@peleke.s/interoception";

normalize([3, 4]); // [0.6, 0.8]
normalize([0, 0]); // [0, 0]
```

### `mean(values)`

Arithmetic mean of a number array. Returns 0 for empty arrays.

```typescript
import { mean } from "@peleke.s/interoception";

mean([1, 2, 3]); // 2
mean([]);         // 0
```

### `clamp01(v)`

Clamp a value to [0, 1].

```typescript
import { clamp01 } from "@peleke.s/interoception";

clamp01(1.5);  // 1
clamp01(-0.3); // 0
clamp01(0.7);  // 0.7
```

## Usage in Custom Metrics

```typescript
import type { MetricFn } from "@peleke.s/interoception";
import { cosineSimilarity, mean, clamp01 } from "@peleke.s/interoception";

const myMetric: MetricFn = {
  name: "goalContextAlignment",
  inverted: false,
  compute(input) {
    if (input.goalEmbeddings.length === 0 || input.contextEmbeddings.length === 0) {
      return 0;
    }

    const sims = input.contextEmbeddings.map((ctx) => {
      const goalSims = input.goalEmbeddings.map((g) => cosineSimilarity(g, ctx));
      return Math.max(...goalSims);
    });

    return clamp01(mean(sims));
  },
};
```

## See Also

- [Metrics](metrics.md) — how the built-in metrics use these utilities
- [Types Reference](../reference/types.md) — type definitions
