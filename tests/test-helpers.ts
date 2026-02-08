import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { state } from '@nerdalytics/beacon'

/**
 * Test helpers for BeaconCache tests.
 *
 * This file contains shared utilities for testing BeaconCache
 * using the real @nerdalytics/beacon state function.
 */

/**
 * Captures console.error calls for testing error handling.
 */
export function captureConsoleError(): {
	messages: string[]
	errors: unknown[]
	restore: () => void
} {
	const originalError = console.error
	const messages: string[] = []
	const errors: unknown[] = []

	console.error = (...args: unknown[]): void => {
		messages.push(args.map(String).join(' '))
		errors.push(...args)
	}

	return {
		errors,
		messages,
		restore: (): void => {
			console.error = originalError
		},
	}
}

/**
 * Creates a temporary directory for database tests.
 * Returns the path and a cleanup function.
 */
export function createTempDir(): {
	path: string
	cleanup: () => void
} {
	const tempDir = mkdtempSync(join(tmpdir(), 'beacon-cache-test-'))

	return {
		cleanup: (): void => {
			try {
				rmSync(tempDir, {
					force: true,
					recursive: true,
				})
			} catch {
				// Ignore cleanup errors
			}
		},
		path: tempDir,
	}
}

/**
 * Helper to create a database path in a temp directory.
 */
export function createTempDbPath(filename: string = 'test.db'): {
	dbPath: string
	cleanup: () => void
} {
	const { path, cleanup } = createTempDir()

	return {
		cleanup,
		dbPath: join(path, filename),
	}
}

/**
 * Creates a beacon state for testing.
 * Re-exports the real state function for convenience.
 */
export const createMockState: unknown = state
