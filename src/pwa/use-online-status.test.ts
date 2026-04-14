// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from "@testing-library/react";
import { useOnlineStatus } from "./use-online-status";

describe("useOnlineStatus", () => {
	const originalOnLine = navigator.onLine;

	afterEach(() => {
		Object.defineProperty(navigator, "onLine", {
			value: originalOnLine,
			writable: true,
			configurable: true,
		});
	});

	it("returns true when browser is online", () => {
		Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(true);
	});

	it("returns false when browser is offline", () => {
		Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(false);
	});

	it("updates to false when offline event fires", () => {
		Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
		const { result } = renderHook(() => useOnlineStatus());

		act(() => {
			Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
			window.dispatchEvent(new Event("offline"));
		});

		expect(result.current).toBe(false);
	});

	it("updates to true when online event fires", () => {
		Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
		const { result } = renderHook(() => useOnlineStatus());

		act(() => {
			Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
			window.dispatchEvent(new Event("online"));
		});

		expect(result.current).toBe(true);
	});

	it("cleans up event listeners on unmount", () => {
		const addSpy = vi.spyOn(window, "addEventListener");
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const { unmount } = renderHook(() => useOnlineStatus());

		expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

		unmount();

		expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));

		addSpy.mockRestore();
		removeSpy.mockRestore();
	});
});
