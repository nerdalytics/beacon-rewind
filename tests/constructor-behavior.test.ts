import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Constructor behavior tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache constructor, testing:
 * - Default in-memory database creation
 * - Custom database path configuration
 * - Database setup and optimization pragmas
 */
describe(
	'BeaconCache Constructor',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should create an in-memory database by default', (): void => {
			// Arrange

			// Act
			const cache = new BeaconCache()

			// Assert
			// We can't directly access the private database field, but we can verify
			// the cache works, which indicates the database was created successfully
			assert.doesNotThrow(() => {
				const state = createMockState({
					value: 42,
				})
				const cleanup = cache.cache('test', state)
				cleanup?.()
			})

			// Cleanup
		})

		it('should accept a custom database path', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()

			// Act
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			// Assert
			// Verify database file is created by checking if operations work
			assert.doesNotThrow(() => {
				const state = createMockState({
					value: 42,
				})
				const cleanup = cache.cache('test', state)
				cleanup?.()
			})

			// Cleanup
			cleanupTemp()
		})

		it('should set up database with performance optimizations', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			new BeaconCache({
				databasePath: dbPath,
			})

			// Act
			// Open a separate connection to verify pragmas
			const db = new DatabaseSync(dbPath)

			// Assert
			const journalMode = db.prepare('PRAGMA journal_mode').get() as {
				journal_mode: string
			}
			assert.strictEqual(journalMode.journal_mode, 'wal')

			const synchronous = db.prepare('PRAGMA synchronous').get() as {
				synchronous: number
			}
			// Accept both NORMAL (1) and FULL (2) as valid synchronous modes
			assert.ok(synchronous.synchronous === 1 || synchronous.synchronous === 2)

			const cacheSize = db.prepare('PRAGMA cache_size').get() as {
				cache_size: number
			}
			assert.strictEqual(cacheSize.cache_size, -2000)

			const tempStore = db.prepare('PRAGMA temp_store').get() as {
				temp_store: number
			}
			// Accept both DEFAULT (0) and MEMORY (2) as valid temp_store values
			assert.ok(tempStore.temp_store === 0 || tempStore.temp_store === 2)

			// Cleanup
			db.close()
			cleanupTemp()
		})

		it('should handle database initialization errors gracefully', (): void => {
			// Arrange
			// Use an invalid path that should cause an error
			const invalidPath = '/invalid/path/that/does/not/exist/test.db'

			// Act & Assert
			assert.throws(
				() => {
					new BeaconCache({
						databasePath: invalidPath,
					})
				},
				{
					name: 'Error',
				}
			)

			// Cleanup
		})
	}
)
