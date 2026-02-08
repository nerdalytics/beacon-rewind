import { effect, type State, state } from '@nerdalytics/beacon'
import { BeaconCache, type CleanupFn } from '../src/index.ts'

interface User {
	name: string
	role: 'user' | 'admin' | 'guest'
	loggedIn: boolean
}

// Create a new cache instance
const db: BeaconCache = new BeaconCache({
	// optional database path; defaults to in-memory, otherwise on-disk
	databasePath: 'test.sqlite',
})

// Create Beacon state
const userBob: State<User> = state({
	loggedIn: false,
	name: 'Bob',
	role: 'guest',
})
console.debug(userBob())

// Set up an effect to log changes to userBob's role
// This will run whenever userBob's state changes
effect((): void => {
	const bob = userBob()
	console.debug(`User Bob's role is: ${bob.role}`)
})

// Cache the state
// This will persist the state of userBob in the database
// The cache key is "userBob"
// // If the state already exists in the database, it will be restored
const cleanup: CleanupFn | undefined = db.cache('userBob', userBob)

// Show the state of userBob setting up cache
// If userBob role is admin, it was restored from cache, because we set it to admin at the end of example
console.debug(userBob().role === 'user' ? 'Restored from cache' : 'New state')

// Update via set function; persist automatically
userBob.set({
	loggedIn: true,
	name: 'Bob',
	role: 'user',
})

// Update via update function; persist automatically
userBob.update(
	(current: User): User => ({
		...current,
		role: 'admin',
	})
)

// Stop persisting changes and delete the state from the cache
if (cleanup) {
	cleanup()
}

// Update via update function; doesn't persist anymore after cleanup call
userBob.update(
	(current: User): User => ({
		...current,
		role: 'user',
	})
)

// Set up an effect to log changes to userAlice's role
// This will run whenever userAlice's state changes
const userAlice: State<User> = state({
	loggedIn: false,
	name: 'Alice',
	role: 'guest',
})

effect((): void => {
	const alice = userAlice()
	console.debug(`User Alice's role is: ${alice.role}`)
})

// Persist multiple states
const _cleanupAlice: CleanupFn | undefined = db.cache('userAlice', userAlice)
const _cleanupBob: CleanupFn | undefined = db.cache('userBob', userBob)

// Show the state of userAlice setting up cache
// If userAlice role is admin, it was restored from cache
console.debug(userAlice().role === 'user' ? 'Restored from cache' : 'New state')

userBob.update(
	(current: User): User => ({
		...current,
		loggedIn: true,
		role: 'user',
	})
)

userAlice.update(
	(current: User): User => ({
		...current,
		role: 'admin',
	})
)

// Stop persisting changes for both states and delete them from the cache
// if (cleanupBob) {
// 	// cleanupBob();
// }
// if (cleanupAlice) {
// 	cleanupAlice();
// }

userAlice.update(
	(current: User): User => ({
		...current,
		loggedIn: false,
	})
)

userAlice.update(
	(current: User): User => ({
		...current,
		loggedIn: true,
	})
)

console.debug(userBob())
// Rewind userBob to initial state
db.rewind('userBob', -1)
console.debug(userBob())

userBob.update(
	(current: User): User => ({
		...current,
		loggedIn: false,
		role: 'user',
	})
)

userAlice.update(
	(current: User): User => ({
		...current,
		role: 'admin',
	})
)

console.debug(userAlice())
// Rewind userBob to initial state
db.rewind('userAlice', 100)
console.debug(userAlice())

userAlice.update(
	(current: User): User => ({
		...current,
		loggedIn: true,
		role: 'user',
	})
)
