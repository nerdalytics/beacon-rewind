import { type Sql, sql } from '../sql.ts'

export const generateSelectQuery = (key: string): Sql => sql`SELECT value FROM kv_store WHERE key = ${key}`
