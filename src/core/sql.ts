/**
 * Values supported by SQL engine.
 */
export type Value = unknown

/**
 * Supported value or SQL instance.
 */
export type RawValue = Value | Sql

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export class Sql {
	readonly values: Value[]
	readonly strings: string[]

	constructor(rawStrings: readonly string[], rawValues: readonly RawValue[]) {
		if (rawStrings.length - 1 !== rawValues.length) {
			if (rawStrings.length === 0) {
				throw new TypeError('Expected at least 1 string')
			}

			throw new TypeError(`Expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`)
		}

		const valuesLength: number = rawValues.reduce<number>(
			(len: number, value: RawValue): number => len + (value instanceof Sql ? value.values.length : 1),
			0
		)

		this.values = new Array<Value>(valuesLength)
		this.strings = new Array<string>(valuesLength + 1)

		this.strings[0] = rawStrings[0] ?? ''

		// Iterate over raw values, strings, and children. The value is always
		// positioned between two strings, e.g. `index + 1`.
		let i = 0
		let pos = 0
		while (i < rawValues.length) {
			const child: RawValue = rawValues[i++]
			const rawString: string | undefined = rawStrings[i]

			// Check for nested `sql` queries.
			if (child instanceof Sql) {
				// Append child prefix text to current string.
				this.strings[pos] += child.strings[0] ?? ''

				let childIndex = 0
				while (childIndex < child.values.length) {
					this.values[pos++] = child.values[childIndex++]
					this.strings[pos] = child.strings[childIndex] ?? ''
				}

				// Append raw string to current string.
				this.strings[pos] += rawString ?? ''
			} else {
				this.values[pos++] = child
				this.strings[pos] = rawString ?? ''
			}
		}
	}

	get sql(): string {
		const len = this.strings.length
		let i = 1
		let value = this.strings[0] ?? ''
		while (i < len) {
			value += `?${this.strings[i++] ?? ''}`
		}
		return value
	}

	get statement(): string {
		const len = this.strings.length
		let i = 1
		let value = this.strings[0] ?? ''
		while (i < len) {
			value += `:${i}${this.strings[i++] ?? ''}`
		}
		return value
	}

	get text(): string {
		const len = this.strings.length
		let i = 1
		let value = this.strings[0] ?? ''
		while (i < len) {
			value += `$${i}${this.strings[i++] ?? ''}`
		}
		return value
	}

	inspect(): {
		sql: string
		statement: string
		text: string
		values: Value[]
	} {
		return {
			sql: this.sql,
			statement: this.statement,
			text: this.text,
			values: this.values,
		}
	}
}

/**
 * Create a SQL query for a list of values.
 */
export const join = (
	values: readonly RawValue[],
	separator: string = ',',
	prefix: string = '',
	suffix: string = ''
): Sql => {
	if (values.length === 0) {
		throw new TypeError('Expected `join([])` to be called with an array of multiple elements, but got an empty array')
	}

	return new Sql(
		[
			prefix,
			...new Array<string>(values.length - 1).fill(separator),
			suffix,
		],
		values
	)
}

/**
 * Create a SQL query for a list of structured values.
 */
export const bulk = (
	data: readonly (readonly RawValue[])[],
	separator: string = ',',
	prefix: string = '',
	suffix: string = ''
): Sql => {
	const length: number = data.length > 0 ? (data[0]?.length ?? 0) : 0

	if (length === 0) {
		throw new TypeError(
			'Expected `bulk([][])` to be called with a nested array of multiple elements, but got an empty array'
		)
	}

	const values: Sql[] = data.map((item: readonly RawValue[], index: number): Sql => {
		if (item.length !== length) {
			throw new TypeError(`Expected \`bulk([${index}][])\` to have a length of ${length}, but got ${item.length}`)
		}

		return new Sql(
			[
				'(',
				...new Array<string>(item.length - 1).fill(separator),
				')',
			],
			item
		)
	})

	return new Sql(
		[
			prefix,
			...new Array<string>(values.length - 1).fill(separator),
			suffix,
		],
		values
	)
}

/**
 * Create raw SQL statement.
 */
export const raw = (value: string): Sql => {
	return new Sql(
		[
			value,
		],
		[]
	)
}

/**
 * Create a SQL object from a template string.
 */
export const sql = (strings: readonly string[], ...values: readonly RawValue[]): Sql => {
	return new Sql(strings, values)
}
