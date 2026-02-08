# src — Source

## Architecture

`BeaconCache` wraps `node:sqlite` (`DatabaseSync`) to persist `@nerdalytics/beacon` `State<T>` values. Each cached key gets its own SQLite table with autoincrementing IDs, enabling time-travel via `rewind()`.

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | `BeaconCache` class — `cache()`, `rewind()`, SQLite lifecycle |
| `core/sql.ts` | Tagged template SQL builder — `sql`, `raw`, `join`, `bulk` |

## BeaconCache Internals

- `#database` — `DatabaseSync` instance (WAL mode, memory-mapped I/O)
- `#tableStatements` — `Map<string, TableStatements>` of prepared statements per key
- `#stateRefs` — `Map<string, WeakRef<State>>` to track live state for `rewind()`
- `cache(key, state)` — creates table, restores latest value, sets up `effect()` to auto-persist, returns cleanup function
- `rewind(key, steps)` — deletes future records, sets state to historical value
- `#sanitizeKeyForTable(key)` — prefixes `cache_` and replaces non-alphanumeric with `_`

## SQL Builder (`core/sql.ts`)

The `Sql` class supports three output formats:
- `.sql` — `?` placeholders (SQLite standard)
- `.statement` — `:1` named placeholders
- `.text` — `$1` positional placeholders (PostgreSQL style)

Helpers: `join()`, `bulk()`, `raw()`, `sql` tagged template

## Prepared Statements (`core/statements/`)

Pre-built SQL generators using the `sql` tagged template. Two subsystems:

**KV Store** (flat key-value lookup):
| File | Purpose |
|------|---------|
| `create-kv-store-table.ts` | Creates `kv_store` table (`key` PK, `value` TEXT) |
| `generate-insert-into-kv-store-query.ts` | Insert/replace key-value pair |
| `generate-select-from-kv-store-query.ts` | Select value by key |
| `generate-delete-from-kv-store-query.ts` | Delete record by key |

**Replay** (per-key time-travel history):
| File | Purpose |
|------|---------|
| `generate-create-replay-table.ts` | Creates per-key replay table (autoincrement `id`, `state`) |
| `generate-insert-into-replay-query.ts` | Insert state snapshot into replay table |

<!--— BEACON-CACHE-START —>[src Index]
|root: ./src
|IMPORTANT: BeaconCache uses private fields (#) — test via public API only
|index.ts:{BeaconCache,Options,CleanupFn}
|core:{sql.ts}
|core/statements:{create-kv-store-table.ts,generate-create-replay-table.ts,generate-insert-into-kv-store-query.ts,generate-insert-into-replay-query.ts,generate-select-from-kv-store-query.ts,generate-delete-from-kv-store-query.ts}
<!--— BEACON-CACHE-END —>
