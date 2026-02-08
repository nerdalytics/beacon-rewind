# Beacon Rewind <img align="right" src="https://raw.githubusercontent.com/nerdalytics/beacon-rewind/refs/heads/trunk/assets/beacon-rewind-logo.svg" width="128px" alt="A stylized lighthouse beacon with golden light against a dark blue background, representing the reactive state library"/>

> Persist Beacon state. Rewind when you need to.


[![license:mit](https://flat.badgen.net/static/license/MIT/blue)](https://github.com/nerdalytics/beacon-rewind/blob/trunk/LICENSE)
[![registry:npm:version](https://img.shields.io/npm/v/@nerdalytics/beacon-rewind.svg)](https://www.npmjs.com/package/@nerdalytics/beacon-rewind)
[![Socket Badge](https://badge.socket.dev/npm/package/@nerdalytics/beacon-rewind/1.0.0)](https://socket.dev/npm/package/@nerdalytics/beacon-rewind/overview/1.0.0)

[![tech:nodejs](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![language:typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![linter:biome](https://img.shields.io/badge/biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)

Persist [`@nerdalytics/beacon`](https://github.com/nerdalytics/beacon) reactive state to SQLite. State changes are automatically saved and restored on restart, with built-in destructive rewind via `rewind()`.

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

## Documentation

Full documentation, API reference, and examples available at:
**[github.com/nerdalytics/beacon-rewind](https://github.com/nerdalytics/beacon-rewind)**

## License

MIT
