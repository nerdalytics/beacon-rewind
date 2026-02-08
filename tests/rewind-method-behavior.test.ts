import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Rewind method behavior tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache.rewind() method, testing:
 * - Historical state retrieval
 * - Weak reference handling
 * - Error handling for invalid keys/steps
 * - Cleanup of garbage collected states
 */
describe(
	'BeaconCache rewind() method',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should rewind state to previous value by specified steps', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				version: 1,
			})

			// Act - Create history
			const cleanup = cache.cache('versionedData', state)

			// Add multiple versions
			for (let i = 2; i <= 5; i++) {
				state.set({
					version: i,
				})
			}

			// Rewind 2 steps back (should get version 3)
			cache.rewind('versionedData', 2)

			// Assert
			assert.deepStrictEqual(state(), {
				version: 3,
			})

			// Cleanup
			cleanup?.()
			cleanupTemp()
		})

		it('should handle rewind when no history exists', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state = createMockState({
				value: 'current',
			})

			const cleanup = cache.cache('noHistory', state)

			// Act
			cache.rewind('noHistory', 5)

			// Assert - State should remain unchanged
			assert.deepStrictEqual(state(), {
				value: 'current',
			})

			// Cleanup
			cleanup?.()
		})

		it('should handle rewind for non-existent key', (): void => {
			// Arrange
			const cache = new BeaconCache()

			// Act & Assert - Should not throw
			assert.doesNotThrow(() => {
				cache.rewind('nonExistentKey', 1)
			})
		})

		it('should handle rewind after cleanup gracefully', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				data: 'test',
			})

			// Cache and then cleanup
			const cleanup = cache.cache('cleanedUp', state)
			state.set({
				data: 'updated',
			})
			cleanup?.() // Clean up - this should drop the table

			// Act - Try to rewind on a cleaned up key
			cache.rewind('cleanedUp', 1)

			// Assert - State should remain unchanged (no error thrown)
			assert.deepStrictEqual(state(), {
				data: 'updated',
			})

			// Cleanup
			cleanupTemp()
		})

		it('should handle rewind with invalid steps parameter', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state = createMockState({
				value: 10,
			})

			const cleanup = cache.cache('testData', state)

			state.update((current) => {
				return {
					value: current.value + 10,
				}
			})

			// Act & Assert - Should not throw with negative steps
			assert.doesNotThrow(() => {
				cache.rewind('testData', -1)
			})

			// Assert - State should rewind to version 0 as we only have 2 changes
			assert.deepStrictEqual(state(), {
				value: 10,
			})

			state.update((current) => {
				return {
					value: current.value + 10,
				}
			})

			// Act & Assert - step 0 should return current value
			assert.doesNotThrow(() => {
				cache.rewind('testData', 0)
			})

			assert.deepStrictEqual(state(), {
				value: 20,
			})

			// Cleanup
			cleanup?.()
		})

		it('should correctly parse JSON values from database during rewind', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const complexData = {
				array: [
					1,
					2,
					3,
				],
				settings: {
					notifications: true,
					theme: 'dark',
				},
				user: {
					id: 1,
					name: 'Test User',
				},
			}
			const state = createMockState(complexData)

			// Act
			const cleanup = cache.cache('complexData', state)

			// Update state
			const newData = {
				...complexData,
				settings: {
					notifications: false,
					theme: 'light',
				},
			}
			state.set(newData)

			// Rewind to get original data
			cache.rewind('complexData', 1)

			// Assert
			assert.deepStrictEqual(state(), complexData)

			// Cleanup
			cleanup?.()
			cleanupTemp()
		})

		it('should handle multiple rewinds on same key', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				step: 0,
			})

			// Act - Create history
			const cleanup = cache.cache('multiRewind', state)

			// Create sequence: 0, 1, 2, 3, 4
			for (let i = 1; i <= 4; i++) {
				state.set({
					step: i,
				})
			}

			// First rewind: go back 2 steps (should be step 2)
			cache.rewind('multiRewind', 2)
			assert.deepStrictEqual(state(), {
				step: 2,
			})

			// Second rewind: go back 3 more steps (should be step 1)
			cache.rewind('multiRewind', 3)
			assert.deepStrictEqual(state(), {
				step: 0,
			})

			// Cleanup
			cleanup?.()
			cleanupTemp()
		})

		it('should handle rewind with corrupted JSON data', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				valid: 'data',
			})

			// Create initial cache
			const cleanup = cache.cache('corruptRewind', state)
			state.set({
				valid: 'updated',
			})

			// Manually corrupt a historical entry
			const db = new DatabaseSync(dbPath)
			db.prepare('UPDATE cache_corruptRewind SET value = ? WHERE id = 1').run('{ invalid json')
			db.close()

			// Act & Assert - Should throw error when trying to rewind to corrupted data
			assert.throws(
				() => {
					cache.rewind('corruptRewind', 1)
				},
				{
					name: 'SyntaxError',
				}
			)

			// State should remain unchanged
			assert.deepStrictEqual(state(), {
				valid: 'updated',
			})

			// Cleanup
			cleanup?.()
			cleanupTemp()
		})
	}
)
