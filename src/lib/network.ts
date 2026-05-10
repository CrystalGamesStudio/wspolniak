// SPDX-License-Identifier: AGPL-3.0-or-later

export type NetworkErrorType =
	| "offline"
	| "timeout"
	| "unauthorized"
	| "client_error"
	| "server_error"
	| "abort"
	| "unknown";

const TIMEOUT_STATUSES = new Set([408, 504]);
const UNAUTHORIZED_STATUSES = new Set([401, 403]);
const SERVER_ERROR_RANGE = { min: 500, max: 599 } as const;
const MAX_RETRY_ATTEMPTS = 3;

function getStatus(error: Error): number | undefined {
	return (error as Error & { status?: number }).status;
}

export function classifyError(error: Error): NetworkErrorType {
	if (error instanceof DOMException && error.name === "AbortError") return "abort";
	if (error instanceof TypeError && error.message === "Failed to fetch") return "offline";

	const status = getStatus(error);
	if (status === 0) return "offline";
	if (status === undefined) return "unknown";
	if (TIMEOUT_STATUSES.has(status)) return "timeout";
	if (UNAUTHORIZED_STATUSES.has(status)) return "unauthorized";
	if (status >= 400 && status < 500) return "client_error";
	if (status >= SERVER_ERROR_RANGE.min && status <= SERVER_ERROR_RANGE.max) return "server_error";
	return "unknown";
}

const USER_MESSAGES: Record<NetworkErrorType, string> = {
	offline: "Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie.",
	timeout: "Serwer nie odpowiada. Spróbuj ponownie za chwilę.",
	unauthorized: "Brak uprawnień. Zaloguj się ponownie.",
	server_error: "Wystąpił błąd serwera. Spróbuj ponownie za chwilę.",
	abort: "Żądanie zostało anulowane.",
	unknown: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
	client_error: "",
};

export function getUserMessage(error: Error): string {
	const type = classifyError(error);
	if (type === "client_error") return error.message;
	return USER_MESSAGES[type];
}

const RETRYABLE_TYPES = new Set<NetworkErrorType>(["offline", "timeout", "server_error"]);

export function shouldRetry(error: Error, attempt: number): boolean {
	if (attempt >= MAX_RETRY_ATTEMPTS) return false;
	return RETRYABLE_TYPES.has(classifyError(error));
}

export interface RetryOptions {
	maxAttempts?: number;
	baseDelay?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
	const maxAttempts = options?.maxAttempts ?? MAX_RETRY_ATTEMPTS;
	const baseDelay = options?.baseDelay ?? 1000;

	let lastError: Error = new Error("No attempts made");

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (!shouldRetry(lastError, attempt + 1)) throw lastError;
			const delay = baseDelay * 2 ** attempt;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError;
}
