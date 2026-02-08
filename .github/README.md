# Beacon Rewind <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon/refs/heads/trunk/assets/beacon-rewind-logo.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Persist Beacon state. Rewind when you need to.


[![license:mit](https://flat.badgen.net/static/license/MIT/blue)](https://github.com/nerdalytics/beacon-rewind/blob/trunk/LICENSE)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon-rewind.svg)](https://www.npmjs.com/package/@nerdalytics/beacon-rewind)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon-rewind/1.0.0)](https://socket.dev/npm/package/@nerdalytics/beacon-rewind/overview/1.0.0)

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

Persist [`@nerdalytics/beacon`](https://github.com/nerdalytics/beacon) reactive state to SQLite. State changes are automatically saved and restored on restart, with built-in destructive rewind via `rewind()`.

<details>
<summary><strong>Table of Contents</strong></summary>

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [BeaconRewind](#beaconrewindoptions)
  - [persist()](#persistkey-state)
  - [rewind()](#rewindkey-steps)
- [How It Works](#how-it-works)
- [Examples](#examples)
- [Development](#development)
- [License](#license)

</details>

## Installation

```
npm install beacon-rewind --save-exact
```

Requires Node.js >= 22 and `@nerdalytics/beacon` as a peer dependency.

## Quick Start

```typescript
import { state } from '@nerdalytics/beacon'
import { BeaconRewind } from 'beacon-rewind'

const db = new BeaconRewind({ databasePath: 'app.sqlite' })
const count = state(0)

// Persist state — restores previous value if it exists
const cleanup = db.persist('count', count)

count.set(1)
count.set(2)
count.set(3)

// Rewind 2 steps: 3 → 2 → 1
db.rewind('count', 2)
console.log(count()) // 1

// Stop persisting and drop the table
cleanup?.()
```

## API Reference

### `BeaconRewind(options?)`

Creates a new instance backed by SQLite.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `databasePath` | `string` | `":memory:"` | Path to SQLite file. Use `:memory:` for in-memory storage. |

```typescript
// In-memory (default)
const db = new BeaconRewind()

// File-backed (persists across restarts)
const db = new BeaconRewind({ databasePath: 'app.sqlite' })
```

The database is configured with WAL journal mode, memory-mapped I/O, and NORMAL synchronous mode for performance.

### `persist(key, state)`

Persists a Beacon state. Restores the latest value from the database if one exists, then automatically saves every subsequent state change via `effect()`.

Returns a cleanup function that stops persisting and drops the table, or `undefined` if the database is closed.

```typescript
const settings = state({ theme: 'dark', lang: 'en' })
const cleanup = db.persist('settings', settings)

// State changes are automatically saved
settings.set({ theme: 'light', lang: 'en' })

// Stop persisting and remove all stored data for this key
cleanup?.()
```

Each key gets its own SQLite table with autoincrementing IDs, preserving the full history of state changes.

### `rewind(key, steps)`

Rewinds a persisted state by the specified number of steps. **This is destructive** — all records after the target are permanently deleted.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | The key to rewind |
| `steps` | `number` | Steps to go back. `0` = no change. Negative or exceeding history = rewind to the beginning. |

```typescript
const counter = state(0)
db.persist('counter', counter)

counter.set(1)  // history: [0, 1]
counter.set(2)  // history: [0, 1, 2]
counter.set(3)  // history: [0, 1, 2, 3]

db.rewind('counter', 2)
// counter() === 1
// history is now: [0, 1] — records for 2 and 3 are gone
```

## How It Works

1. **`persist(key, state)`** creates a SQLite table named `cache_<sanitized_key>` with an autoincrementing `id` and a `value` column storing JSON-serialized state.

2. On first call, the latest value is read from the table and set on the state. A Beacon `effect()` is set up to insert a new row on every state change.

3. **`rewind(key, steps)`** calculates the target record, deletes all rows after it, and sets the state to the target value.

4. The **cleanup function** returned by `persist()` disposes the effect, removes the state reference, and drops the table.

Keys are sanitized for safe use as SQLite table names: non-alphanumeric characters are replaced with `_` and prefixed with `cache_`.

## Examples

```bash
# Basic usage with persist and rewind
node examples/basic-usage.ts

# Persistence across restarts
node examples/persistence-demo.ts
```

## Development

```bash
# Run tests with coverage
node --test --experimental-test-coverage tests/**/*.test.ts

# Lint and format
biome check
```

## License

This project is licensed under the MIT License. See the [LICENSE][1] file for details.

<div align="center">
  <img src="https://raw.githubusercontent.com/nerdalytics/nerdalytics/refs/heads/main/nerdalytics-logo-gray-transparent.svg" width="128px">
</div>

<!-- Links collection -->

[1]: ../LICENSE
