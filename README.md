# Beacon Cache

> Persistent SQLite cache with time-travel for Beacon state

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

A persistent cache for [`@nerdalytics/beacon`](https://github.com/nerdalytics/beacon) reactive state using SQLite. State changes are automatically persisted and restored on restart, with built-in time-travel via `rewind()`.

## Installation

```
npm install beacon-cache --save-exact
```

Requires Node.js >= 22 and `@nerdalytics/beacon` as a peer dependency.

## Quick Start

```typescript
import { state } from '@nerdalytics/beacon'
import { BeaconCache } from 'beacon-cache'

const cache = new BeaconCache({ databasePath: 'app.sqlite' })
const count = state(0)

// Persist state — restores previous value if it exists
const cleanup = cache.cache('count', count)

count.set(1)
count.set(2)
count.set(3)

// Rewind 2 steps: 3 → 2 → 1
cache.rewind('count', 2)
console.log(count()) // 1

// Stop persisting and drop the table
cleanup?.()
```

## License

MIT
