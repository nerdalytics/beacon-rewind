import { type Sql, sql } from '../sql.ts'

export const generateInsertQuery = (key: string, serializedValue: string): Sql => sql`
	INSERT OR REPLACE INTO kv_store (key, value)
	VALUES (${key}, ${serializedValue})
`
