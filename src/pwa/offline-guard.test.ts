// SPDX-License-Identifier: AGPL-3.0-or-later
import { guardOnlineMutation, OfflineError } from "./offline-guard";

describe("guardOnlineMutation", () => {
	const originalOnLine = navigator.onLine;

	afterEach(() => {
		Object.defineProperty(navigator, "onLine", {
			value: originalOnLine,
			writable: true,
			configurable: true,
		});
	});

	it("executes the mutation when online", async () => {
		Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
		const fn = vi.fn().mockResolvedValue("result");

		const result = await guardOnlineMutation(fn)();

		expect(fn).toHaveBeenCalledOnce();
		expect(result).toBe("result");
	});

	it("throws OfflineError with Polish message when offline", async () => {
		Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
		const fn = vi.fn();

		await expect(guardOnlineMutation(fn)()).rejects.toThrow(OfflineError);
		await expect(guardOnlineMutation(fn)()).rejects.toThrow("Brak połączenia");
		expect(fn).not.toHaveBeenCalled();
	});

	it("passes through arguments to the wrapped function", async () => {
		Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
		const fn = vi.fn().mockResolvedValue("ok");

		const wrapped = guardOnlineMutation(fn);
		await wrapped("arg1", "arg2");

		expect(fn).toHaveBeenCalledWith("arg1", "arg2");
	});
});
