// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { classifyError, getUserMessage, type NetworkErrorType, shouldRetry } from "./network";

describe("classifyError", () => {
	it("classifies TypeError (fetch failed) as offline", () => {
		const error = new TypeError("Failed to fetch");
		expect(classifyError(error)).toBe<NetworkErrorType>("offline");
	});

	it("classifies AbortError as abort", () => {
		const error = new DOMException("The operation was aborted", "AbortError");
		expect(classifyError(error)).toBe<NetworkErrorType>("abort");
	});

	it("classifies response with status 0 as offline", () => {
		const error = new Error("Network error");
		(error as Error & { status?: number }).status = 0;
		expect(classifyError(error)).toBe<NetworkErrorType>("offline");
	});

	it("classifies 408 as timeout", () => {
		const error = new Error("Request timeout");
		(error as Error & { status?: number }).status = 408;
		expect(classifyError(error)).toBe<NetworkErrorType>("timeout");
	});

	it("classifies 504 as timeout", () => {
		const error = new Error("Gateway timeout");
		(error as Error & { status?: number }).status = 504;
		expect(classifyError(error)).toBe<NetworkErrorType>("timeout");
	});

	it("classifies 401 as unauthorized", () => {
		const error = new Error("Unauthorized");
		(error as Error & { status?: number }).status = 401;
		expect(classifyError(error)).toBe<NetworkErrorType>("unauthorized");
	});

	it("classifies 403 as unauthorized", () => {
		const error = new Error("Forbidden");
		(error as Error & { status?: number }).status = 403;
		expect(classifyError(error)).toBe<NetworkErrorType>("unauthorized");
	});

	it("classifies 404 as client_error", () => {
		const error = new Error("Not found");
		(error as Error & { status?: number }).status = 404;
		expect(classifyError(error)).toBe<NetworkErrorType>("client_error");
	});

	it("classifies 422 as client_error", () => {
		const error = new Error("Validation failed");
		(error as Error & { status?: number }).status = 422;
		expect(classifyError(error)).toBe<NetworkErrorType>("client_error");
	});

	it("classifies 500 as server_error", () => {
		const error = new Error("Internal server error");
		(error as Error & { status?: number }).status = 500;
		expect(classifyError(error)).toBe<NetworkErrorType>("server_error");
	});

	it("classifies 502 as server_error", () => {
		const error = new Error("Bad gateway");
		(error as Error & { status?: number }).status = 502;
		expect(classifyError(error)).toBe<NetworkErrorType>("server_error");
	});

	it("classifies 503 as server_error", () => {
		const error = new Error("Service unavailable");
		(error as Error & { status?: number }).status = 503;
		expect(classifyError(error)).toBe<NetworkErrorType>("server_error");
	});

	it("classifies unknown errors as unknown", () => {
		expect(classifyError(new Error("Something went wrong"))).toBe<NetworkErrorType>("unknown");
	});
});

describe("getUserMessage", () => {
	it("returns offline message", () => {
		const error = new TypeError("Failed to fetch");
		expect(getUserMessage(error)).toBe(
			"Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie.",
		);
	});

	it("returns timeout message", () => {
		const error = new Error("Timeout");
		(error as Error & { status?: number }).status = 408;
		expect(getUserMessage(error)).toBe("Serwer nie odpowiada. Spróbuj ponownie za chwilę.");
	});

	it("returns unauthorized message", () => {
		const error = new Error("Unauthorized");
		(error as Error & { status?: number }).status = 401;
		expect(getUserMessage(error)).toBe("Brak uprawnień. Zaloguj się ponownie.");
	});

	it("returns client error with original message", () => {
		const error = new Error("Nie udało się usunąć posta");
		(error as Error & { status?: number }).status = 404;
		expect(getUserMessage(error)).toBe("Nie udało się usunąć posta");
	});

	it("returns server error message", () => {
		const error = new Error("Internal server error");
		(error as Error & { status?: number }).status = 500;
		expect(getUserMessage(error)).toBe("Wystąpił błąd serwera. Spróbuj ponownie za chwilę.");
	});

	it("returns abort message", () => {
		const error = new DOMException("Aborted", "AbortError");
		expect(getUserMessage(error)).toBe("Żądanie zostało anulowane.");
	});

	it("returns generic message for unknown errors", () => {
		expect(getUserMessage(new Error("Something"))).toBe(
			"Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
		);
	});
});

describe("shouldRetry", () => {
	it("retries server errors", () => {
		const error = new Error("Server error");
		(error as Error & { status?: number }).status = 500;
		expect(shouldRetry(error, 1)).toBe(true);
	});

	it("retries offline errors", () => {
		expect(shouldRetry(new TypeError("Failed to fetch"), 1)).toBe(true);
	});

	it("retries timeout errors", () => {
		const error = new Error("Timeout");
		(error as Error & { status?: number }).status = 504;
		expect(shouldRetry(error, 1)).toBe(true);
	});

	it("does not retry client errors (4xx)", () => {
		const error = new Error("Not found");
		(error as Error & { status?: number }).status = 404;
		expect(shouldRetry(error, 1)).toBe(false);
	});

	it("does not retry unauthorized errors", () => {
		const error = new Error("Unauthorized");
		(error as Error & { status?: number }).status = 401;
		expect(shouldRetry(error, 1)).toBe(false);
	});

	it("does not retry abort errors", () => {
		const error = new DOMException("Aborted", "AbortError");
		expect(shouldRetry(error, 1)).toBe(false);
	});

	it("does not retry unknown errors", () => {
		expect(shouldRetry(new Error("Something"), 1)).toBe(false);
	});

	it("respects max attempts", () => {
		const error = new Error("Server error");
		(error as Error & { status?: number }).status = 500;
		expect(shouldRetry(error, 4)).toBe(false);
	});

	it("retries up to 3 attempts by default", () => {
		const error = new Error("Server error");
		(error as Error & { status?: number }).status = 500;
		expect(shouldRetry(error, 3)).toBe(false);
	});
});
