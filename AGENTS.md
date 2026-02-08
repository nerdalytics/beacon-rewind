# beacon-cache

Persistent SQLite cache with time-travel for `@nerdalytics/beacon` reactive state.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `node --test --experimental-test-coverage tests/**/*.test.ts` | Run all tests with coverage |
| `node examples/basic-usage.ts` | Run basic usage example |
| `node examples/cache-restoration-demo.ts` | Run cache restoration demo |
| `npx npm-check-updates --interactive --upgrade --removeRange` | Update dependencies |

## Stack

- **Runtime**: Node.js >= 22 (native TypeScript, `node:sqlite`, `node:test`)
- **Peer dep**: `@nerdalytics/beacon` (reactive state primitives: `state`, `effect`)
- **Linter**: Biome (tabs, single quotes, 120 line width)
- **TypeScript**: Strict mode, ESNext target, NodeNext modules, no emit

## Conventions

- Use `node:` protocol for all Node.js built-in imports
- No build step — TypeScript runs natively via Node.js 22+
- Tests use `node:test` (`describe`/`it`) with `node:assert/strict`
- Biome enforces `useExplicitType` — all functions need explicit return types
- No `any` — `noExplicitAny` is enforced

<!--— BEACON-CACHE-START —>[beacon-cache Index]
|root: .
|IMPORTANT: Read folder AGENTS.md before working in that domain
|src:{AGENTS.md}
|tests:{AGENTS.md}
|examples:{basic-usage.ts,cache-restoration-demo.ts}
<!--— BEACON-CACHE-END —>
