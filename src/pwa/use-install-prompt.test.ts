// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from "@testing-library/react";
import { useInstallPrompt } from "./use-install-prompt";

describe("useInstallPrompt", () => {
	it("initially canInstall is false", () => {
		const { result } = renderHook(() => useInstallPrompt());
		expect(result.current.canInstall).toBe(false);
	});

	it("sets canInstall to true when beforeinstallprompt fires", () => {
		const { result } = renderHook(() => useInstallPrompt());

		act(() => {
			const event = new Event("beforeinstallprompt");
			Object.assign(event, { prompt: vi.fn(), preventDefault: vi.fn() });
			window.dispatchEvent(event);
		});

		expect(result.current.canInstall).toBe(true);
	});

	it("promptInstall calls prompt() on the captured event", async () => {
		const { result } = renderHook(() => useInstallPrompt());

		const promptFn = vi.fn().mockResolvedValue({ outcome: "accepted" });

		act(() => {
			const event = new Event("beforeinstallprompt");
			Object.assign(event, { prompt: promptFn, preventDefault: vi.fn() });
			window.dispatchEvent(event);
		});

		await act(async () => {
			await result.current.promptInstall();
		});

		expect(promptFn).toHaveBeenCalledOnce();
	});

	it("sets canInstall to false after appinstalled fires", () => {
		const { result } = renderHook(() => useInstallPrompt());

		act(() => {
			const event = new Event("beforeinstallprompt");
			Object.assign(event, { prompt: vi.fn(), preventDefault: vi.fn() });
			window.dispatchEvent(event);
		});

		expect(result.current.canInstall).toBe(true);

		act(() => {
			window.dispatchEvent(new Event("appinstalled"));
		});

		expect(result.current.canInstall).toBe(false);
	});
});
