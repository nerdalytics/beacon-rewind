import { type Sql, sql } from '../sql.ts'

export const createTable: Sql = sql`
	CREATE TABLE IF NOT EXISTS kv_store (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)
`
