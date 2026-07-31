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

// biome-ignore lint/suspicious/noExplicitAny: Required for flexible generic constraint
export class QueryBuilder<T extends Record<string, any>> {
	private items: T[];

	constructor(collection: Record<string, T> | T[]) {
		this.items = Array.isArray(collection)
			? collection
			: Object.values(collection);
	}

	// biome-ignore lint/suspicious/noExplicitAny: Required for flexible generic constraint
	where<K extends keyof T>(field: K, op: Operator, value: any): this {
		// Optimize "in" and "not-in" operators by converting the target array to a Set
		// This reduces lookup complexity from O(N) to O(1) per item, improving performance for large arrays
		const isSetQuery = Array.isArray(value) && (op === "in" || op === "not-in");
		const valueSet = isSetQuery ? new Set(value) : null;

		this.items = this.items.filter((item) => {
			const itemValue = item[field];
			switch (op) {
				case "==":
					return itemValue === value;
				case "!=":
					return itemValue !== value;
				case "<":
					return itemValue < value;
				case "<=":
					return itemValue <= value;
				case ">":
					return itemValue > value;
				case ">=":
					return itemValue >= value;
				case "in":
					return valueSet ? valueSet.has(itemValue) : false;
				case "not-in":
					return valueSet ? !valueSet.has(itemValue) : false;
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

// biome-ignore lint/suspicious/noExplicitAny: Required for flexible generic constraint
export function query<T extends Record<string, any>>(
	collection: Record<string, T> | T[],
): QueryBuilder<T> {
	return new QueryBuilder(collection);
}
