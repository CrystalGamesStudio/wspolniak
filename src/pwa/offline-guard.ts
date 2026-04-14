export class OfflineError extends Error {
	constructor() {
		super("Brak połączenia");
		this.name = "OfflineError";
	}
}

export function guardOnlineMutation<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
	return (...args: TArgs) => {
		if (!navigator.onLine) {
			return Promise.reject(new OfflineError());
		}
		return fn(...args);
	};
}
