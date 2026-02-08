import assert from 'node:assert/strict'
import { chmodSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { captureConsoleError, createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Error handling tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache error handling, testing:
 * - Graceful handling of database errors
 * - Console error logging
 * - Recovery from errors
 * - Edge case handling
 */
describe(
	'BeaconCache Error Handling',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should handle database connection errors', (): void => {
			// Arrange
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
		})

		it('should handle invalid database paths', (): void => {
			// Arrange
			const errorCapture = captureConsoleError()

			// Try to create cache with read-only directory
			const invalidPath = '/dev/null/test.db'

			// Act & Assert
			assert.throws(() => {
				new BeaconCache({
					databasePath: invalidPath,
				})
			})

			// Cleanup
			errorCapture.restore()
		})

		it('should handle JSON serialization errors', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state = createMockState({})
			const errorCapture = captureConsoleError()

			// Create circular reference
			interface CircularRef {
				name: string
				self?: CircularRef
			}
			const circular: CircularRef = {
				name: 'circular',
			}
			circular.self = circular

			// Act
			const cleanup = cache.cache('circular', state)
			state.set(circular)

			// Assert
			assert.ok(errorCapture.messages.some((msg) => msg.includes('Error inserting value for key circular')))

			// Cleanup
			errorCapture.restore()
			cleanup?.()
		})

		it('should handle JSON deserialization errors', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				valid: 'data',
			})
			const errorCapture = captureConsoleError()

			// Create valid entry first
			const cleanup = cache.cache('corrupt', state)

			// Manually corrupt the data
			const db = new DatabaseSync(dbPath)
			db.prepare('UPDATE cache_corrupt SET value = ?').run('{ invalid json')
			db.close()

			// Act - Try to retrieve corrupted data
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState({
				default: 'value',
			})
			const cleanup2 = cache2.cache('corrupt', state2)

			// Assert
			assert.ok(errorCapture.messages.some((msg) => msg.includes('Error getting latest value for key corrupt')))
			// State should retain default value
			assert.deepStrictEqual(state2(), {
				default: 'value',
			})

			// Cleanup
			errorCapture.restore()
			cleanup?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should handle cleanup errors gracefully', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				data: 'cleanup error test',
			})
			const errorCapture = captureConsoleError()

			// Act
			const cleanup = cache.cache('cleanupError', state)

			// Close the database connection to simulate an error condition
			const db = new DatabaseSync(dbPath)
			db.close()

			// Call cleanup - should handle the closed database gracefully
			cleanup?.()

			// Assert - Should not throw even with closed database
			// The cleanup was called without throwing
			assert.ok(true)

			// Cleanup
			errorCapture.restore()
			cleanupTemp()
		})

		it('should handle caching with very large values', (): void => {
			// Arrange
			const cache = new BeaconCache()
			// Create a very large object
			const largeData = {
				data: 'x'.repeat(1000000), // 1MB string
			}
			const state = createMockState(largeData)

			// Act & Assert - Should handle large data without issues
			assert.doesNotThrow(() => {
				const cleanup = cache.cache('largeData', state)
				cleanup?.()
			})

			// Cleanup
		})

		it('should handle corrupted table schema', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()

			// Create a table with wrong schema
			const db = new DatabaseSync(dbPath)
			db.exec(`
			CREATE TABLE cache_wrongSchema (
				wrong_column TEXT
			);
		`)
			db.close()

			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				data: 'test',
			})

			// Act & Assert - This should throw due to wrong schema
			assert.throws(
				(): void => {
					cache.cache('wrongSchema', state)
					state.update((current) => {
						return {
							...current,
							data: 'updated',
						}
					})
				},
				{
					message: /no.*(column|such)/,
				}
			)

			// Cleanup
			cleanupTemp()
		})

		it('should continue working after encountering errors', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state1 = createMockState({
				value: 1,
			})
			const state2 = createMockState({
				value: 2,
			})
			const errorCapture = captureConsoleError()

			// Act - First try with an extremely long key that might cause issues
			const veryLongKey = 'x'.repeat(10000)

			// This should work despite the long key
			const cleanup1 = cache.cache(veryLongKey, state1)
			assert.ok(cleanup1 !== undefined)
			cleanup1?.()

			// Now try with a normal key - should still work
			const cleanup2 = cache.cache('working', state2)

			// Assert
			assert.ok(cleanup2 !== undefined)

			// Cleanup
			errorCapture.restore()
			cleanup2?.()
		})

		it('should handle database pragma errors', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()

			// Create database file but make it read-only
			const db = new DatabaseSync(dbPath)
			db.close()

			try {
				chmodSync(dbPath, 0o444) // Read-only
			} catch {
				// Skip test if chmod fails (Windows)
				cleanupTemp()
				return
			}

			// Act & Assert - Should throw when trying to write to read-only database
			assert.throws(
				() => {
					new BeaconCache({
						databasePath: dbPath,
					})
				},
				{
					message: /readonly|read-only/i,
				}
			)

			// Cleanup
			chmodSync(dbPath, 0o644) // Restore permissions
			cleanupTemp()
		})

		it('should handle very large step values in rewind', (): void => {
			// Arrange
			const cache = new BeaconCache()
			const state = createMockState({
				value: 'test',
			})

			const cleanup = cache.cache('largeStep', state)

			// Act - Rewind with huge step value
			assert.doesNotThrow(() => {
				cache.rewind('largeStep', Number.MAX_SAFE_INTEGER)
			})

			// State should remain unchanged
			assert.deepStrictEqual(state(), {
				value: 'test',
			})

			// Cleanup
			cleanup?.()
		})
	}
)
