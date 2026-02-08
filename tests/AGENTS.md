# tests — Test Suite

## Structure

Tests use `node:test` (`describe`/`it`) with `node:assert/strict`. Each file covers one behavioral domain of `BeaconCache`.

## Key Files

| File | Purpose |
|------|---------|
| `test-helpers.ts` | Shared utilities: `captureConsoleError()`, `createTempDir()`, `createTempDbPath()`, `createMockState` (re-export of real `state`) |
| `test.template.ts` | Template for new test files |
| `constructor-behavior.test.ts` | Constructor options, database initialization |
| `cache-method-behavior.test.ts` | `cache()` method: persistence, cleanup, state restoration |
| `rewind-method-behavior.test.ts` | `rewind()` method: time-travel, edge cases |
| `data-serialization.test.ts` | JSON serialization of complex types |
| `database-table-management.test.ts` | Table creation, naming, lifecycle |
| `error-handling.test.ts` | Error paths, closed database, invalid keys |
| `key-sanitization.test.ts` | Key-to-table-name sanitization rules |
| `memory-management.test.ts` | WeakRef cleanup, GC behavior |

## Conventions

- Tests use real `@nerdalytics/beacon` state (not mocks)
- Temp directories via `createTempDbPath()` for file-backed DB tests
- In-memory DBs (`:memory:`) preferred for speed
- Console capture via `captureConsoleError()` — always call `restore()` in cleanup

## Running

```bash
node --test --experimental-test-coverage tests/**/*.test.ts
```

<!--— BEACON-CACHE-START —>[tests Index]
|root: ./tests
|IMPORTANT: Use test-helpers.ts utilities — do not duplicate helper logic
|test-helpers.ts:{captureConsoleError,createTempDir,createTempDbPath,createMockState}
|test.template.ts:{template}
|*.test.ts:{describe,it}
<!--— BEACON-CACHE-END —>
