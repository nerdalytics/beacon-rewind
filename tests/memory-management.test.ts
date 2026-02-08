import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconRewind } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Memory management tests for BeaconRewind.
 *
 * This file contains unit tests for BeaconRewind memory management, testing:
 * - Cleanup function behavior
 * - Table and view cleanup
 * - Multiple cache operations
 * - Error handling during cleanup
 */
describe(
	'BeaconRewind Memory Management',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should drop table when cleanup function is called', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				data: 'cleanup test',
			})

			// Act
			const cleanup = cache.persist('dropTest', state)

			// Verify table exists
			const db = new DatabaseSync(dbPath)
			let tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_dropTest'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 1)

			// Call cleanup
			cleanup?.()

			// Assert - Table should be dropped
			tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_dropTest'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 0)

			// Cleanup
			db.close()
			cleanupTemp()
		})

		it('should handle multiple cleanup calls gracefully', (): void => {
			// Arrange
			const cache = new BeaconRewind()
			const state = createMockState({
				value: 'multiple cleanup',
			})

			// Act
			const cleanup = cache.persist('multiCleanup', state)

			// Assert - Multiple cleanup calls should not throw
			assert.doesNotThrow(() => {
				cleanup?.()
				cleanup?.()
				cleanup?.()
			})

			// Cleanup
		})

		it('should handle multiple cache operations', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const cleanups: Array<(() => void) | undefined> = []

			// Act - Create many cached states
			for (let i = 0; i < 10; i++) {
				const state = createMockState({
					index: i,
				})
				const cleanup = cache.persist(`key_${i}`, state)
				cleanups.push(cleanup)
			}

			// Verify all tables exist
			const db = new DatabaseSync(dbPath)
			let tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_key_%' ORDER BY name")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 10)

			// Cleanup half
			for (let i = 0; i < 5; i++) {
				cleanups[i]?.()
			}

			// Assert - Half should be cleaned up
			tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_key_%' ORDER BY name")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 5)

			// Cleanup rest
			for (let i = 5; i < 10; i++) {
				cleanups[i]?.()
			}

			// Assert - All should be cleaned up
			tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_key_%'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 0)

			// Cleanup
			db.close()
			cleanupTemp()
		})

		it('should handle State reference replacement', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				version: 1,
			})
			const state2 = createMockState({
				version: 2,
			})

			// Act
			const cleanup1 = cache.persist('replace', state1)
			const cleanup2 = cache.persist('replace', state2)

			// Assert - Both cleanups should work
			assert.ok(cleanup1)
			assert.ok(cleanup2)
			assert.notStrictEqual(cleanup1, cleanup2)

			// State1 should still have its original value
			assert.deepStrictEqual(state1(), {
				version: 1,
			})

			// State2 should have been initialized with the persisted value from state1
			// When caching with an existing key, the state gets the last persisted value
			assert.deepStrictEqual(state2(), {
				version: 1,
			})

			// Cleanup
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should clean up view along with table', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				view: 'test',
			})

			// Act
			const cleanup = cache.persist('viewCleanup', state)

			// Verify view exists
			const db = new DatabaseSync(dbPath)
			let views = db
				.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='cache_viewCleanup_latest'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(views.length, 1)

			// Call cleanup
			cleanup?.()

			// Assert - View should be dropped
			views = db
				.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='cache_viewCleanup_latest'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(views.length, 0)

			// Cleanup
			db.close()
			cleanupTemp()
		})

		it('should allow caching after cleanup', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				round: 1,
			})
			const state2 = createMockState({
				round: 2,
			})

			// Act - First round
			const cleanup1 = cache.persist('reuse', state1)
			cleanup1?.()

			// Second round - should work fine
			const cleanup2 = cache.persist('reuse', state2)

			// Assert - Table should exist again
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_reuse'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 1)

			// Cleanup
			db.close()
			cleanup2?.()
			cleanupTemp()
		})

		it('should handle concurrent cleanup operations', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const states = Array.from(
				{
					length: 5,
				},
				(_, i) =>
					createMockState({
						id: i,
					})
			)
			const cleanups = states.map((state, i) => cache.persist(`concurrent_${i}`, state))

			// Act - Cleanup all at once (simulating concurrent cleanup)
			for (const cleanup of cleanups) {
				cleanup?.()
			}

			// Assert - All tables should be gone
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_concurrent_%'")
				.all() as Array<{
				name: string
			}>
			assert.strictEqual(tables.length, 0)

			// Cleanup
			db.close()
			cleanupTemp()
		})
	}
)
