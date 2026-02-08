import { type Sql, sql } from '../sql.ts'

export const generateReplayTable = (key: string): Sql => sql`
	CREATE TABLE IF NOT EXISTS replay_${key} (
		key id PRIMARY KEY AUTO INCREMENT,
		state TEXT NOT NULL
	)
`
