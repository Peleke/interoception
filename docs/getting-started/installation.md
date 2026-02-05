# Installation

## Prerequisites

- Node.js 22 or later
- pnpm (recommended) or npm

## Install

```bash
# pnpm (recommended)
pnpm add @peleke.s/interoception

# npm
npm install @peleke.s/interoception

# yarn
yarn add @peleke.s/interoception
```

## Peer Dependency

Interoception depends on [`@peleke.s/cadence`](https://peleke.github.io/cadence/) as a peer dependency. It re-exports the `Tick` type for clock integration.

```bash
pnpm add @peleke.s/cadence
```

## TypeScript Configuration

Interoception is written in TypeScript with strict mode. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "module": "ESNext"
  }
}
```

## Verify Installation

```typescript
import { createPreExecSensor } from "@peleke.s/interoception";
console.log(typeof createPreExecSensor); // 'function'
```
