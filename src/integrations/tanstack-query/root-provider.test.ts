// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { getContext } from "./root-provider";

describe("QueryClient configuration", () => {
	it("retries server errors up to 3 times", () => {
		const { queryClient } = getContext();
		const retry = queryClient.getDefaultOptions().queries?.retry;
		expect(typeof retry).toBe("function");

		const serverError = new Error("Server error");
		(serverError as Error & { status?: number }).status = 500;

		const retryFn = retry as (failureCount: number, error: Error) => boolean;
		expect(retryFn(0, serverError)).toBe(true);
		expect(retryFn(1, serverError)).toBe(true);
		expect(retryFn(2, serverError)).toBe(false);
	});

	it("does not retry client errors", () => {
		const { queryClient } = getContext();
		const retry = queryClient.getDefaultOptions().queries?.retry as (
			failureCount: number,
			error: Error,
		) => boolean;

		const clientError = new Error("Not found");
		(clientError as Error & { status?: number }).status = 404;

		expect(retry(0, clientError)).toBe(false);
	});

	it("does not retry unauthorized errors", () => {
		const { queryClient } = getContext();
		const retry = queryClient.getDefaultOptions().queries?.retry as (
			failureCount: number,
			error: Error,
		) => boolean;

		const authError = new Error("Unauthorized");
		(authError as Error & { status?: number }).status = 401;

		expect(retry(0, authError)).toBe(false);
	});

	it("retries offline errors", () => {
		const { queryClient } = getContext();
		const retry = queryClient.getDefaultOptions().queries?.retry as (
			failureCount: number,
			error: Error,
		) => boolean;

		expect(retry(0, new TypeError("Failed to fetch"))).toBe(true);
	});
});
