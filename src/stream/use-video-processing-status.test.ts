// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from "@testing-library/react";
import { useVideoProcessingStatus } from "./use-video-processing-status";

vi.stubGlobal("fetch", vi.fn());

const mockFetch = vi.mocked(fetch);

describe("useVideoProcessingStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts with idle status when no uid provided", () => {
		const { result } = renderHook(() => useVideoProcessingStatus(null));

		expect(result.current.status).toBe("idle");
		expect(result.current.thumbnailUrl).toBeNull();
	});

	it("fetches status immediately when uid is provided", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					data: { status: "processing", thumbnailUrl: null },
				}),
		} as Response);

		const { result } = renderHook(() => useVideoProcessingStatus("uid-1"));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(result.current.status).toBe("processing");
		expect(mockFetch).toHaveBeenCalledWith("/api/app/videos/uid-1/status", {
			credentials: "include",
		});
	});

	it("polls every 5 seconds while processing", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						data: { status: "processing", thumbnailUrl: null },
					}),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						data: { status: "ready", thumbnailUrl: "https://thumb.jpg" },
					}),
			} as Response);

		const { result } = renderHook(() => useVideoProcessingStatus("uid-1"));

		// First fetch
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(result.current.status).toBe("processing");
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Advance 5 seconds for next poll
		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000);
		});

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(result.current.status).toBe("ready");
		expect(result.current.thumbnailUrl).toBe("https://thumb.jpg");
	});

	it("stops polling when status is ready", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					data: { status: "ready", thumbnailUrl: "https://thumb.jpg" },
				}),
		} as Response);

		const { result } = renderHook(() => useVideoProcessingStatus("uid-1"));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(result.current.status).toBe("ready");

		// Advance time — should NOT poll again
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10000);
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("stops polling when status is error", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					data: { status: "error", thumbnailUrl: null },
				}),
		} as Response);

		const { result } = renderHook(() => useVideoProcessingStatus("uid-1"));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		expect(result.current.status).toBe("error");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10000);
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("cleans up polling interval on unmount", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					data: { status: "processing", thumbnailUrl: null },
				}),
		} as Response);

		const { unmount } = renderHook(() => useVideoProcessingStatus("uid-1"));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});

		unmount();

		const callCount = mockFetch.mock.calls.length;

		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});

		expect(mockFetch).toHaveBeenCalledTimes(callCount);
	});
});
