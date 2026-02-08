import { DatabaseSync, type StatementSync } from 'node:sqlite'
import type { State } from '@nerdalytics/beacon'
import { effect } from '@nerdalytics/beacon'

// Database configuration constants
const DATABASE_CONFIG = {
	cacheSize: -64000,
	journalMode: 'WAL',
	mmapSize: 268435456,
	synchronous: 'NORMAL',
	tempStore: 'MEMORY',
} as const

/**
 * Configuration options for BeaconRewind
 */
export interface Options {
	/**
	 * Path to the SQLite database file. Defaults to ":memory:" for in-memory storage
	 */
	databasePath?: string
}

interface TableStatements {
	insert: StatementSync
	selectLatest: StatementSync
	selectBySteps: StatementSync
	selectOldest: StatementSync
	countRecords: StatementSync
	deleteAfter: StatementSync
	drop: StatementSync
}

export type CleanupFn = () => void

/**
 * Persist Beacon state. Rewind when you need to.
 * Provides time-travel capabilities by storing historical state values.
 */
export class BeaconRewind {
	#database: DatabaseSync
	#databasePath: string
	#tableStatements = new Map<string, TableStatements>()
	#stateRefs = new Map<string, WeakRef<State<unknown>>>()

	constructor(options?: Options) {
		this.#databasePath = options?.databasePath || ':memory:'
		this.#database = new DatabaseSync(this.#databasePath)

		if (this.#database.isOpen) {
			this.#setupDatabase()
		}
	}

	/**
	 * Persists a Beacon state with automatic synchronization.
	 * Returns a cleanup function to stop persisting, or undefined if database is closed.
	 *
	 * @param key - Unique identifier for the cached state
	 * @param state - The Beacon state to persist
	 * @returns Cleanup function to stop persisting and remove the table, or undefined
	 */
	persist<T>(key: string, state: State<T>): CleanupFn | undefined {
		if (!this.#database.isOpen) {
			return
		}

		this.#stateRefs.set(key, new WeakRef(state))

		try {
			this.#ensureTableExists(key)

			const persistedValue = this.#getLatest<T>(key)
			if (persistedValue !== undefined) {
				state.set(persistedValue)
			}

			const cleanup = effect((): void => {
				const currentValue = state()
				this.#insert<T>(key, currentValue)
			})

			return (): void => {
				cleanup()
				this.#stateRefs.delete(key)
				this.#dropTable(key)
			}
		} catch (error: unknown) {
			// Clean up the state reference if initialization fails
			// This cleanup is necessary to prevent memory leaks when persist() throws
			this.#stateRefs.delete(key)
			throw error
		}
	}

	/**
	 * Rewinds a persisted state by the specified number of steps.
	 *
	 * @param key - The key to rewind
	 * @param steps - Number of steps to rewind (0 = no change, negative or >= total records = rewind to beginning)
	 */
	rewind(key: string, steps: number): void {
		const stateRef = this.#stateRefs.get(key)
		if (!stateRef) {
			return
		}

		const state = stateRef.deref()
		if (!state) {
			this.#stateRefs.delete(key)
			return
		}

		const statements = this.#tableStatements.get(key)
		if (!statements) {
			return
		}

		// Handle step 0 - no rewind needed
		if (steps === 0) {
			return
		}

		// Get the total number of records
		const countResult = statements.countRecords.get() as
			| {
					count: number
			  }
			| undefined
		const recordCount = countResult?.count ?? 0

		if (recordCount <= 1) {
			// Nothing to rewind if we have 0 or 1 records
			return
		}

		// Calculate which record should be the new latest after rewinding
		let targetRecordPosition: number
		if (steps < 0 || steps >= recordCount - 1) {
			// If negative steps or rewinding more than available, keep only the first record
			targetRecordPosition = 1
		} else {
			// Otherwise, go back by 'steps' from the current position
			targetRecordPosition = recordCount - steps
		}

		// Get the ID of the target record
		const offset = targetRecordPosition - 1
		const targetResult = statements.selectBySteps.get({
			steps: offset,
		}) as
			| {
					id: number
					value: string
			  }
			| undefined

		if (!targetResult) {
			return
		}

		// Store the target value before deletion in case we need to update state
		const targetValue = targetResult.value

		// Delete all records after the target record
		statements.deleteAfter.run({
			id: targetResult.id,
		})

		// Only update the state if the deletion was successful
		// Parse and set the target value (which is now the latest)
		const historicalValue = JSON.parse(targetValue)
		state.set(historicalValue)
	}

	#setupDatabase(): void {
		this.#database.exec(`
			PRAGMA journal_mode = ${DATABASE_CONFIG.journalMode};
			PRAGMA synchronous = ${DATABASE_CONFIG.synchronous};
			PRAGMA cache_size = ${DATABASE_CONFIG.cacheSize};
			PRAGMA temp_store = ${DATABASE_CONFIG.tempStore};
			PRAGMA mmap_size = ${DATABASE_CONFIG.mmapSize};
		`)
	}

	#ensureTableExists(key: string): void {
		if (this.#tableStatements.has(key)) {
			return
		}

		const tableName = this.#sanitizeKeyForTable(key)
		const viewName = `${tableName}_latest`

		try {
			this.#database.exec(`
				CREATE TABLE IF NOT EXISTS ${tableName} (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					value TEXT NOT NULL
				) STRICT;
			`)

			this.#database.exec(`
				CREATE VIEW IF NOT EXISTS ${viewName} AS
				SELECT id, value FROM ${tableName}
				ORDER BY id DESC;
			`)

			const statements: TableStatements = {
				countRecords: this.#database.prepare(`
					SELECT COUNT(*) as count FROM ${tableName}
				`),

				deleteAfter: this.#database.prepare(`
					DELETE FROM ${tableName} WHERE id > $id
				`),

				drop: this.#database.prepare(`
					DROP TABLE IF EXISTS ${tableName}
				`),
				insert: this.#database.prepare(`
					INSERT INTO ${tableName} (value) VALUES ($value)
				`),

				selectBySteps: this.#database.prepare(`
					SELECT id, value FROM ${tableName} ORDER BY id ASC LIMIT 1 OFFSET $steps
				`),

				selectLatest: this.#database.prepare(`
					SELECT value FROM ${viewName} LIMIT 1
				`),

				selectOldest: this.#database.prepare(`
					SELECT value FROM ${tableName} ORDER BY id ASC LIMIT 1
				`),
			}

			this.#tableStatements.set(key, statements)
		} catch (error) {
			console.error(`Error creating table for key ${key}:`, error)
			throw error
		}
	}

	#sanitizeKeyForTable(key: string): string {
		return `cache_${key.replace(/[^a-zA-Z0-9]/g, '_')}`
	}

	#insert<T>(key: string, value: T): void {
		const statements = this.#tableStatements.get(key)
		if (!statements) {
			return
		}

		try {
			const serializedValue = JSON.stringify(value)
			statements.insert.run({
				value: serializedValue,
			})
		} catch (error) {
			console.error(`Error inserting value for key ${key}:`, error)
		}
	}

	#getLatest<T>(key: string): T | undefined {
		const statements = this.#tableStatements.get(key)
		if (!statements) {
			return
		}

		try {
			const result = statements.selectLatest.get() as
				| {
						value: string
				  }
				| undefined
			if (result?.value) {
				return JSON.parse(result.value) as T
			}
		} catch (error) {
			console.error(`Error getting latest value for key ${key}:`, error)
		}

		return
	}

	#dropTable(key: string): void {
		const statements = this.#tableStatements.get(key)
		if (!statements) {
			return
		}

		const tableName = this.#sanitizeKeyForTable(key)

		try {
			this.#database.exec(`DROP VIEW IF EXISTS ${tableName}_latest`)
			statements.drop.run()
			this.#tableStatements.delete(key)
		} catch (error) {
			console.error(`Error dropping table for key ${key}:`, error)
		}
	}
}
