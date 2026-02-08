import { type Sql, sql } from '../sql.ts'

export const generateInsertQuery = (key: string, serializedValue: string): Sql => sql`
	INSERT OR REPLACE INTO replay_${key} (key, value)
	VALUES (${key}, ${serializedValue})
`
