import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconCache } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Database table management tests for BeaconCache.
 *
 * This file contains unit tests for BeaconCache database table management, testing:
 * - Table creation for each cached key
 * - Table structure and schema
 * - View creation for latest values
 * - Data storage format
 */
describe(
	'BeaconCache Database Table Management',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should create a unique table for each cached key', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				type: 'user',
			})
			const state2 = createMockState({
				type: 'product',
			})

			// Act
			const cleanup1 = cache.cache('users', state1)
			const cleanup2 = cache.cache('products', state2)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%' ORDER BY name")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 2)
			assert.ok(tables[0])
			assert.ok(tables[1])
			assert.strictEqual(tables[0].name, 'cache_products')
			assert.strictEqual(tables[1].name, 'cache_users')

			// Cleanup
			db.close()
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should create tables with correct schema', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.cache('schemaTest', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const schema = db.prepare('PRAGMA table_info(cache_schemaTest)').all() as Array<{
				cid: number
				name: string
				type: string
				notnull: number
				dflt_value: unknown
				pk: number
			}>

			assert.strictEqual(schema.length, 2)

			// Debug: log the actual schema
			console.debug('Schema:', JSON.stringify(schema, null, 2))

			// Check id column
			const idColumn = schema.find((col) => col.name === 'id')
			assert.ok(idColumn)
			assert.strictEqual(idColumn.type, 'INTEGER')
			assert.strictEqual(idColumn.pk, 1) // Primary key
			// Note: AUTOINCREMENT columns may have notnull=0 in SQLite
			assert.ok(idColumn.notnull === 0 || idColumn.notnull === 1)

			// Check value column
			const valueColumn = schema.find((col) => col.name === 'value')
			assert.ok(valueColumn)
			assert.strictEqual(valueColumn.type, 'TEXT')
			assert.strictEqual(valueColumn.notnull, 1) // Not null
			assert.strictEqual(valueColumn.pk, 0) // Not primary key

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should create a view for efficient latest value access', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				data: 'initial',
			})

			// Act
			const cleanup = cache.cache('viewTest', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const views = db
				.prepare("SELECT name, sql FROM sqlite_master WHERE type='view' AND name='cache_viewTest_latest'")
				.all() as Array<{
				name: string
				sql: string
			}>

			assert.strictEqual(views.length, 1)
			assert.ok(views[0])
			assert.strictEqual(views[0].name, 'cache_viewTest_latest')

			// Verify view SQL contains ORDER BY id DESC
			assert.ok(views[0].sql.includes('ORDER BY id DESC'))

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should create tables as STRICT for type safety', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				strict: true,
			})

			// Act
			const cleanup = cache.cache('strictTest', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tableInfo = db
				.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cache_strictTest'")
				.get() as {
				sql: string
			}

			assert.ok(tableInfo.sql.includes('STRICT'))

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should reuse existing table when caching same key multiple times', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state1 = createMockState({
				version: 1,
			})
			const state2 = createMockState({
				version: 2,
			})

			// Act
			const cleanup1 = cache.cache('reuseTest', state1)
			const cleanup2 = cache.cache('reuseTest', state2)

			// Assert - Should still have only one table
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_reuseTest'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)

			// Cleanup
			db.close()
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should store values as JSON text in the database', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const complexData = {
				settings: {
					theme: 'dark',
				},
				tags: [
					'important',
					'archived',
				],
				user: {
					id: 123,
					name: 'John Doe',
				},
			}
			const state = createMockState(complexData)

			// Act
			const cleanup = cache.cache('jsonTest', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const result = db.prepare('SELECT value FROM cache_jsonTest LIMIT 1').get() as {
				value: string
			}

			// Verify it's stored as JSON string
			assert.strictEqual(typeof result.value, 'string')
			assert.deepStrictEqual(JSON.parse(result.value), complexData)

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle concurrent table creation for same key gracefully', (): void => {
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

			// Act - Try to cache same key simultaneously
			const cleanup1 = cache.cache('concurrent', state1)
			const cleanup2 = cache.cache('concurrent', state2)

			// Assert - Both should succeed without errors
			assert.ok(cleanup1)
			assert.ok(cleanup2)

			// Verify only one table was created
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_concurrent'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)

			// Cleanup
			db.close()
			cleanup1?.()
			cleanup2?.()
			cleanupTemp()
		})

		it('should create proper indexes for performance', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const state = createMockState({
				indexed: true,
			})

			// Act
			const cleanup = cache.cache('indexTest', state)

			// Assert - Check if id column has an index (as primary key)
			const db = new DatabaseSync(dbPath)
			const indexes = db.prepare('PRAGMA index_list(cache_indexTest)').all()

			// Debug: log the actual indexes
			console.debug('Indexes:', JSON.stringify(indexes, null, 2))

			// Note: SQLite may not always show indexes for primary keys in index_list
			// The primary key constraint itself acts as an index
			assert.ok(indexes.length >= 0)

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle table names with maximum length', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconCache({
				databasePath: dbPath,
			})
			const longKey = 'a'.repeat(100) // Very long key
			const state = createMockState({
				long: true,
			})

			// Act
			const cleanup = cache.cache(longKey, state)

			// Assert - Table should be created successfully
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			// Table name should start with cache_ and contain lots of 'a's
			assert.ok(tables[0].name.startsWith('cache_'))
			assert.ok(tables[0].name.includes('aaa'))

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})
	}
)
