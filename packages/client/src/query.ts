export type Operator =
	| "=="
	| "!="
	| "<"
	| "<="
	| ">"
	| ">="
	| "in"
	| "not-in"
	| "contains";

export interface PaginationOptions {
	page: number;
	limit: number;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export class QueryBuilder<T extends Record<string, unknown>> {
	private items: T[];

	constructor(collection: Record<string, T> | T[]) {
		this.items = Array.isArray(collection)
			? collection
			: Object.values(collection);
	}

	where<K extends keyof T>(field: K, op: Operator, value: unknown): this {
		this.items = this.items.filter((item) => {
			const itemValue = item[field];
			switch (op) {
				case "==":
					return itemValue === value;
				case "!=":
					return itemValue !== value;
				case "<":
					// @ts-expect-error Type coercion for comparison
					return itemValue < value;
				case "<=":
					// @ts-expect-error Type coercion for comparison
					return itemValue <= value;
				case ">":
					// @ts-expect-error Type coercion for comparison
					return itemValue > value;
				case ">=":
					// @ts-expect-error Type coercion for comparison
					return itemValue >= value;
				case "in":
					return Array.isArray(value) && value.includes(itemValue);
				case "not-in":
					return Array.isArray(value) && !value.includes(itemValue);
				case "contains":
					return Array.isArray(itemValue) && itemValue.includes(value);
				default:
					return false;
			}
		});
		return this;
	}

	orderBy<K extends keyof T>(
		field: K,
		direction: "asc" | "desc" = "asc",
	): this {
		this.items.sort((a, b) => {
			const aVal = a[field];
			const bVal = b[field];
			if (aVal < bVal) return direction === "asc" ? -1 : 1;
			if (aVal > bVal) return direction === "asc" ? 1 : -1;
			return 0;
		});
		return this;
	}

	limit(count: number): this {
		this.items = this.items.slice(0, count);
		return this;
	}

	offset(count: number): this {
		this.items = this.items.slice(count);
		return this;
	}

	paginate(options: PaginationOptions): PaginatedResult<T> {
		const total = this.items.length;
		const { page, limit } = options;
		const totalPages = Math.ceil(total / limit);
		const start = (page - 1) * limit;
		const items = this.items.slice(start, start + limit);

		return {
			items,
			total,
			page,
			limit,
			totalPages,
		};
	}

	first(): T | undefined {
		return this.items[0];
	}

	all(): T[] {
		return this.items;
	}
}

export function query<T extends Record<string, unknown>>(
	collection: Record<string, T> | T[],
): QueryBuilder<T> {
	return new QueryBuilder(collection);
}
