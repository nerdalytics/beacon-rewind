import { type Sql, sql } from '../sql.ts'

export const generateDeleteQuery = (key: string): Sql => sql`
	DELETE FROM kv_store WHERE key = ${key}
`
