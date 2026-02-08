import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { BeaconRewind } from '../src/index.ts'
import { createMockState, createTempDbPath } from './test-helpers.ts'

/**
 * Key sanitization tests for BeaconRewind.
 *
 * This file contains unit tests for BeaconRewind key sanitization, testing:
 * - Conversion of non-alphanumeric characters to underscores
 * - Prefix addition for valid table names
 * - Handling of special characters and edge cases
 */
describe(
	'BeaconRewind Key Sanitization',
	{
		concurrency: true,
		timeout: 1000,
	},
	(): void => {
		it('should preserve alphanumeric characters in keys', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('user123Data', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			assert.strictEqual(tables[0].name, 'cache_user123Data')

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should convert special characters to underscores', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			const testCases = [
				{
					expected: 'cache_user_data',
					key: 'user:data',
				},
				{
					expected: 'cache_user_email_com',
					key: 'user@email.com',
				},
				{
					expected: 'cache_user_profile',
					key: 'user/profile',
				},
				{
					expected: 'cache_user_name',
					key: 'user-name',
				},
				{
					expected: 'cache_user_config',
					key: 'user.config',
				},
				{
					expected: 'cache_user_123',
					key: 'user#123',
				},
				{
					expected: 'cache_user_amount',
					key: 'user$amount',
				},
				{
					expected: 'cache_user_percent',
					key: 'user%percent',
				},
				{
					expected: 'cache_user_data',
					key: 'user&data',
				},
				{
					expected: 'cache_user_star',
					key: 'user*star',
				},
				{
					expected: 'cache_user_plus',
					key: 'user+plus',
				},
				{
					expected: 'cache_user_equals',
					key: 'user=equals',
				},
				{
					expected: 'cache_user_array_',
					key: 'user[array]',
				},
				{
					expected: 'cache_user_object_',
					key: 'user{object}',
				},
				{
					expected: 'cache_user_parens_',
					key: 'user(parens)',
				},
				{
					expected: 'cache_user_space',
					key: 'user space',
				},
			]

			for (const { key, expected } of testCases) {
				// Act
				const cleanup = cache.persist(key, state)

				// Assert
				const db = new DatabaseSync(dbPath)
				const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(expected) as
					| {
							name: string
					  }
					| undefined

				assert.ok(table, `Table ${expected} should exist for key "${key}"`)
				assert.strictEqual(table.name, expected)

				// Cleanup
				db.close()
				cleanup?.()
			}

			// Final cleanup
			cleanupTemp()
		})

		it('should handle keys with multiple consecutive special characters', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('user:::data', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_user%data'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			assert.strictEqual(tables[0].name, 'cache_user___data')

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle unicode characters in keys', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('user_émoji_😀_data', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_user%data'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			// Unicode characters are converted to underscores
			// The exact conversion depends on the sanitization logic
			assert.ok(tables[0].name.startsWith('cache_user'))
			assert.ok(tables[0].name.includes('moji'))
			assert.ok(tables[0].name.endsWith('data'))

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle empty keys', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_'").all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle very long keys', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})
			const longKey = `${'a'.repeat(1000)}_special_chars_!@#$%^&*()`

			// Act
			const cleanup = cache.persist(longKey, state)

			// Assert - Verify table was created (name might be truncated by SQLite)
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			assert.ok(tables[0].name.startsWith('cache_'))
			assert.ok(tables[0].name.includes('aaa')) // Should have some 'a's

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should handle keys that look like SQL injection attempts', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			const sqlInjectionKeys = [
				"user'; DROP TABLE users; --",
				'user" OR "1"="1',
				'user`; DELETE FROM cache_test;',
				"user'); INSERT INTO cache_test VALUES ('hack');--",
			]

			for (const key of sqlInjectionKeys) {
				// Act
				const cleanup = cache.persist(key, state)

				// Assert - Verify the key was sanitized and table created safely
				const db = new DatabaseSync(dbPath)
				const tables = db
					.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name LIKE 'cache_user%'")
					.get() as {
					count: number
				}

				assert.ok(tables.count >= 1, `Table should exist for sanitized key: "${key}"`)

				// Verify no SQL injection occurred
				const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
					name: string
				}>

				// Should only have cache_ tables, no 'users' table from injection
				assert.ok(allTables.every((t) => t.name.startsWith('cache_') || t.name.startsWith('sqlite_')))

				// Cleanup
				db.close()
				cleanup?.()
			}

			// Final cleanup
			cleanupTemp()
		})

		it('should handle keys starting with numbers', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('123userData', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache_123userData'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			// The cache_ prefix ensures the table name is valid even if key starts with number
			assert.strictEqual(tables[0].name, 'cache_123userData')

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})

		it('should produce consistent sanitization for same key', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache1 = new BeaconRewind({
				databasePath: dbPath,
			})
			const cache2 = new BeaconRewind({
				databasePath: dbPath,
			})
			const cache3 = new BeaconRewind({
				databasePath: dbPath,
			})
			const complexKey = 'user@domain.com/profile#123'
			const state = createMockState({
				value: 'test',
			})

			// Act - Cache with same key multiple times
			const cleanup1 = cache1.persist(complexKey, state)
			const cleanup2 = cache2.persist(complexKey, state)
			const cleanup3 = cache3.persist(complexKey, state)

			// Assert - Should always produce same table name
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cache_%'")
				.all() as Array<{
				name: string
			}>

			// Should only have one table despite multiple cache calls
			assert.strictEqual(tables.length, 1)
			assert.ok(tables[0])
			assert.strictEqual(tables[0].name, 'cache_user_domain_com_profile_123')

			// Cleanup
			db.close()
			cleanup1?.()
			cleanup2?.()
			cleanup3?.()
			cleanupTemp()
		})

		it('should handle keys with only special characters', (): void => {
			// Arrange
			const { dbPath, cleanup: cleanupTemp } = createTempDbPath()
			const cache = new BeaconRewind({
				databasePath: dbPath,
			})
			const state = createMockState({
				value: 'test',
			})

			// Act
			const cleanup = cache.persist('!@#$%^&*()', state)

			// Assert
			const db = new DatabaseSync(dbPath)
			const tables = db
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cache___________'")
				.all() as Array<{
				name: string
			}>

			assert.strictEqual(tables.length, 1)

			// Cleanup
			db.close()
			cleanup?.()
			cleanupTemp()
		})
	}
)
