import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Cache method behavior tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache.cache() method, testing:
 * - Return value handling (cleanup function)
 * - Table creation for keys
 * - Initial value restoration
 * - Automatic persistence via effects
 * - Cleanup functionality
 */
describe(
	'BeaconCache cache() method',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should return a cleanup function', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state = createMockState({
				count: 0,
			})

			// Act
			const cleanup = cache.cache('testKey', state)

			// Assert
			assert.ok(cleanup !== undefined)
			assert.strictEqual(typeof cleanup, 'function')

			// Cleanup
			cleanup()
		})

		it('should create a table for the cached key', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.cache('myKey', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			assert.strictEqual(tables[0].name, 'cache_myKey')

			// Also check view was created
			const views = db
				.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(views.length, 1)
			assert.ok(views[0])
			assert.strictEqual(views[0].name, 'cache_myKey_latest')

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should restore latest persisted value to state', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache1 = new BeaconCache({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				count: 0,
			})

			// First, cache and update a value
			const cleanup1 = cache1.cache('counter', state1)
			state1.set({
				count: 42,
			})

			// Don't call cleanup1 - we want to keep the data!
			// Just create new cache instance with same database
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState({
				count: 0,
			})

			// Act
			const cleanup2 = cache2.cache('counter', state2)

			// Assert
			assert.deepStrictEqual(state2(), {
				count: 42,
			})

			// Cleanup everything at the end
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should persist state changes automatically', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				name: 'initial',
			})

			// Act
			const cleanup = cache.cache('user', state)

			// Simulate state change
			state.set({
				name: 'updated',
			})

			// Assert - Check database directly
			const db = new DatabaseSync(dbPath)
			const results = db.prepare('SELECT value FROM cache_user ORDER BY id DESC').all() as Array<{
				value: string
			}>

			// Should have both initial and updated values
			assert.ok(results.length >= 2)
			assert.ok(results[0])
			assert.deepStrictEqual(JSON.parse(results[0].value), {
				name: 'updated',
			})

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle multiple keys independently', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state1 = createMockState({
				type: 'user',
			})
			const state2 = createMockState({
				type: 'product',
			})

			// Act
			const cleanup1 = cache.cache('key1', state1)
			const cleanup2 = cache.cache('key2', state2)

			// Assert
			assert.ok(cleanup1 !== undefined)
			assert.ok(cleanup2 !== undefined)
			assert.notStrictEqual(cleanup1, cleanup2)

			// Cleanup
			cleanup1?.()
			cleanup2?.()
		})

		it('should handle non-existent values gracefully', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				default: 'value',
			})

			// Act - Cache a key that has no previous value
			const cleanup = cache.cache('nonExistent', state)

			// Assert - State should retain its initial value
			assert.deepStrictEqual(state(), {
				default: 'value',
			})

			// Cleanup
			cleanup?.()
			cleanupTemp()
		})

		it('should cache same key multiple times with different states', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				instance: 1,
			})
			const state2 = createMockState({
				instance: 2,
			})

			// Act
			const cleanup1 = cache.cache('shared', state1)
			state1.set({
				instance: 10,
			})

			const cleanup2 = cache.cache('shared', state2)

			// Assert - state2 should get the value from state1
			assert.deepStrictEqual(state2(), {
				instance: 10,
			})

			// Cleanup
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})
	}
)
