import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { captureConsoleError, createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Data serialization tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache data serialization, testing:
 * - JSON serialization when storing values
 * - JSON deserialization when retrieving values
 * - Handling of various data types
 * - Error handling for serialization failures
 */
describe(
	'BeaconCache Data Serialization',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should serialize and deserialize primitive values', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			const testCases = [
				{
					key: 'string',
					value: 'Hello, World!',
				},
				{
					key: 'number',
					value: 42,
				},
				{
					key: 'boolean',
					value: true,
				},
				{
					key: 'null',
					value: null,
				},
			]

			for (const { key, value } of testCases) {
				// Act
				const state = createMockState(value)
				const cleanup = cache.cache(key, state)

				// Create new instance to test retrieval
				const cache2 = new BeaconCache({
					databasePath: dbPath,
				})
				const state2 = createMockState(null)
				const cleanup2 = cache2.cache(key, state2)

				// Assert
				assert.strictEqual(state2(), value)

				// Cleanup
				cleanup?.()
				cleanup2?.()
			}

			// Cleanup
			cleanupTemp()
		})

		it('should serialize and deserialize complex objects', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			const complexObject = {
				settings: {
					features: [
						'feature1',
						'feature2',
						'feature3',
					],
					limits: {
						maxItems: 1000,
						maxSize: 50.5,
					},
				},
				user: {
					email: 'john@example.com',
					id: 123,
					metadata: {
						createdAt: '2024-01-01T00:00:00.000Z',
						preferences: {
							notifications: true,
							theme: 'dark',
						},
					},
					name: 'John Doe',
				},
			}

			// Act
			const state = createMockState(complexObject)
			const cleanup = cache.cache('complex', state)

			// Create new instance to test retrieval
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState({})
			const cleanup2 = cache2.cache('complex', state2)

			// Assert
			assert.deepStrictEqual(state2(), complexObject)

			// Cleanup
			cleanup?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should serialize and deserialize arrays', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			const testArrays = [
				{
					key: 'numbers',
					value: [
						1,
						2,
						3,
						4,
						5,
					],
				},
				{
					key: 'strings',
					value: [
						'apple',
						'banana',
						'cherry',
					],
				},
				{
					key: 'mixed',
					value: [
						1,
						'two',
						true,
						null,
						{
							nested: 'object',
						},
					],
				},
				{
					key: 'empty',
					value: [],
				},
				{
					key: 'nested',
					value: [
						[
							1,
							2,
						],
						[
							3,
							4,
						],
						[
							5,
							6,
						],
					],
				},
			]

			for (const { key, value } of testArrays) {
				// Act
				const state = createMockState(value)
				const cleanup = cache.cache(key, state)

				// Create new instance to test retrieval
				const cache2 = new BeaconCache({
					databasePath: dbPath,
				})
				const state2 = createMockState([])
				const cleanup2 = cache2.cache(key, state2)

				// Assert
				assert.deepStrictEqual(state2(), value)

				// Cleanup
				cleanup?.()
				cleanup2?.()
			}

			// Cleanup
			cleanupTemp()
		})

		it('should handle circular references gracefully', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({})

			// Create circular reference that can't be serialized
			interface CircularRef {
				name: string
				self?: CircularRef
			}
			const circular: CircularRef = {
				name: 'test',
			}
			circular.self = circular

			const errorCapture = captureConsoleError()

			// Act - The actual effect implementation in BeaconCache will try to serialize
			const cleanup = cache.cache('circular', state)

			// This should work without throwing
			assert.doesNotThrow(() => {
				state.set(circular)
			})

			// Since our mock effect doesn't actually persist, we can't test the error message
			// The important thing is that setting circular data doesn't crash the system

			// Cleanup
			errorCapture.restore()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle special JSON values', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			// Test cases for special values
			const testCases = [
				{
					expected: {
						date: '2024-01-01T00:00:00.000Z',
					}, // Dates serialize to strings
					key: 'date',
					value: {
						date: new Date('2024-01-01T00:00:00.000Z'),
					},
				},
				{
					expected: {}, // undefined properties are omitted in JSON
					key: 'undefined',
					value: {
						prop: undefined,
					},
				},
				{
					expected: {
						num: null,
					}, // Infinity becomes null in JSON
					key: 'infinity',
					value: {
						num: Number.POSITIVE_INFINITY,
					},
				},
				{
					expected: {
						num: null,
					}, // NaN becomes null in JSON
					key: 'nan',
					value: {
						num: Number.NaN,
					},
				},
			]

			for (const { key, value, expected } of testCases) {
				// Act
				const state = createMockState(value)
				const cleanup = cache.cache(key, state)

				// Create new instance to test retrieval
				const cache2 = new BeaconCache({
					databasePath: dbPath,
				})
				const state2 = createMockState({})
				const cleanup2 = cache2.cache(key, state2)

				// Assert
				assert.deepStrictEqual(state2(), expected)

				// Cleanup
				cleanup?.()
				cleanup2?.()
			}

			// Cleanup
			cleanupTemp()
		})

		it('should handle large data serialization', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			// Create large object
			const largeArray = Array.from(
				{
					length: 10000,
				},
				(_, i) => ({
					data: {
						timestamp: Date.now(),
						value: Math.random(),
					},
					id: i,
					name: `Item ${i}`,
				})
			)

			// Act
			const state = createMockState(largeArray)
			const cleanup = cache.cache('largeData', state)

			// Create new instance to test retrieval
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState([])
			const cleanup2 = cache2.cache('largeData', state2)

			// Assert
			assert.strictEqual(state2().length, 10000)
			assert.deepStrictEqual(state2()[0], largeArray[0])
			assert.deepStrictEqual(state2()[9999], largeArray[9999])

			// Cleanup
			cleanup?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should preserve data types through serialization', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			const dataWithTypes = {
				array: [
					1,
					2,
					3,
				],
				boolean: false,
				integer: 100,
				nullValue: null,
				number: 42.5,
				object: {
					nested: true,
				},
				string: 'text',
			}

			// Act
			const state = createMockState(dataWithTypes)
			const cleanup = cache.cache('types', state)

			// Create new instance to test retrieval
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState({})
			const cleanup2 = cache2.cache('types', state2)

			// Assert - Check each type
			const retrieved = state2() as typeof dataWithTypes
			assert.strictEqual(typeof retrieved.string, 'string')
			assert.strictEqual(typeof retrieved.number, 'number')
			assert.strictEqual(typeof retrieved.integer, 'number')
			assert.strictEqual(typeof retrieved.boolean, 'boolean')
			assert.strictEqual(retrieved.nullValue, null)
			assert.ok(Array.isArray(retrieved.array))
			assert.strictEqual(typeof retrieved.object, 'object')
			assert.strictEqual(retrieved.object.nested, true)

			// Cleanup
			cleanup?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should handle deserialization errors gracefully', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				valid: 'data',
			})
			const errorCapture = captureConsoleError()

			// Act - First cache valid data
			const cleanup = cache.cache('corrupt', state)

			// Manually corrupt the data in database
			const db = new DatabaseSync(dbPath)
			db.prepare('UPDATE cache_corrupt SET value = ? WHERE id = 1').run('invalid json {')
			db.close()

			// Try to retrieve corrupted data
			const cache2 = new BeaconCache({
				databasePath: dbPath,
			})
			const state2 = createMockState(null)
			const cleanup2 = cache2.cache('corrupt', state2)

			// Assert - Should handle error and state remains at initial value
			assert.ok(errorCapture.messages.some((msg) => msg.includes('Error getting latest value')))
			assert.strictEqual(state2(), null)

			// Cleanup
			errorCapture.restore()
			cleanup?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should handle empty strings and whitespace', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})

			const testCases = [
				{
					key: 'empty',
					value: '',
				},
				{
					key: 'space',
					value: ' ',
				},
				{
					key: 'whitespace',
					value: '  \t\n  ',
				},
				{
					key: 'objectWithEmpty',
					value: {
						empty: '',
						space: ' ',
					},
				},
			]

			for (const { key, value } of testCases) {
				// Act
				const state = createMockState(value)
				const cleanup = cache.cache(key, state)

				// Create new instance to test retrieval
				const cache2 = new BeaconCache({
					databasePath: dbPath,
				})
				const state2 = createMockState(null)
				const cleanup2 = cache2.cache(key, state2)

				// Assert
				assert.deepStrictEqual(state2(), value)

				// Cleanup
				cleanup?.()
				cleanup2?.()
			}

			// Cleanup
			cleanupTemp()
		})

		it('should verify data is stored as JSON text in database', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const testData = {
				active: true,
				id: 123,
				name: 'Test User',
			}

			// Act
			const state = createMockState(testData)
			const cleanup = cache.cache('jsonStorage', state)

			// Assert - Check raw database content
			const db = new DatabaseSync(dbPath)
			const result = db.prepare('SELECT value, typeof(value) as type FROM cache_jsonStorage').get() as {
				value: string
				type: string
			}

			assert.strictEqual(result.type, 'text')
			assert.strictEqual(typeof result.value, 'string')
			assert.deepStrictEqual(JSON.parse(result.value), testData)

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})
	}
)
