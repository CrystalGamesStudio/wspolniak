// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./network";

describe("withRetry", () => {
	it("returns result on first success", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(fn);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries on server error and succeeds", async () => {
		const serverError = new Error("Server error");
		(serverError as Error & { status?: number }).status = 500;

		const fn = vi.fn().mockRejectedValueOnce(serverError).mockResolvedValueOnce("ok");

		const result = await withRetry(fn);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("does not retry client errors", async () => {
		const clientError = new Error("Not found");
		(clientError as Error & { status?: number }).status = 404;

		const fn = vi.fn().mockRejectedValue(clientError);

		await expect(withRetry(fn)).rejects.toThrow("Not found");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("does not retry abort errors", async () => {
		const fn = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));

		await expect(withRetry(fn)).rejects.toThrow("Aborted");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("gives up after max retries", async () => {
		const serverError = new Error("Server error");
		(serverError as Error & { status?: number }).status = 500;

		const fn = vi.fn().mockRejectedValue(serverError);

		await expect(withRetry(fn)).rejects.toThrow("Server error");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("respects custom maxAttempts", async () => {
		const serverError = new Error("Server error");
		(serverError as Error & { status?: number }).status = 500;

		const fn = vi.fn().mockRejectedValue(serverError);

		await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow("Server error");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("uses exponential backoff between retries", async () => {
		vi.useFakeTimers();

		const serverError = new Error("Server error");
		(serverError as Error & { status?: number }).status = 500;

		const fn = vi.fn().mockRejectedValueOnce(serverError).mockResolvedValueOnce("ok");

		const promise = withRetry(fn, { baseDelay: 1000 });

		// First call happens immediately
		expect(fn).toHaveBeenCalledTimes(1);

		// Advance by 1000ms (first backoff)
		await vi.advanceTimersByTimeAsync(1000);
		expect(fn).toHaveBeenCalledTimes(2);

		const result = await promise;
		expect(result).toBe("ok");

		vi.useRealTimers();
	});
});
