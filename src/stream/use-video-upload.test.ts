// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, renderHook } from "@testing-library/react";
import { useVideoUpload } from "./use-video-upload";

vi.stubGlobal("fetch", vi.fn());

const mockFetch = vi.mocked(fetch);

function createMockXHR() {
	const xhr = {
		open: vi.fn(),
		send: vi.fn(),
		setRequestHeader: vi.fn(),
		abort: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		upload: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
		status: 200,
		responseText: "",
		readyState: 4,
	};
	return xhr;
}

let mockXHRInstance: ReturnType<typeof createMockXHR>;

const MockXHR = vi.fn(function MockXHR(this: ReturnType<typeof createMockXHR>) {
	mockXHRInstance = createMockXHR();
	Object.assign(this, mockXHRInstance);
});
vi.stubGlobal("XMLHttpRequest", MockXHR);

describe("useVideoUpload", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("starts upload and tracks progress", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({ data: { uid: "uid-1", uploadURL: "https://upload.example.com" } }),
		} as Response);

		const { result } = renderHook(() => useVideoUpload());

		const file = new File(["video-content"], "test.mp4", { type: "video/mp4" });

		act(() => {
			result.current.upload(file);
		});

		// Wait for fetch to resolve (get upload URL)
		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});

		// XHR should be opened and sent
		expect(mockXHRInstance.open).toHaveBeenCalledWith("POST", "https://upload.example.com");
		expect(mockXHRInstance.send).toHaveBeenCalled();

		// Simulate progress event (50%)
		act(() => {
			const progressHandler = mockXHRInstance.upload.addEventListener.mock.calls.find(
				(call) => call[0] === "progress",
			)?.[1];
			progressHandler?.({ loaded: 5, total: 10, lengthComputable: true });
		});

		expect(result.current.progress).toBe(50);
		expect(result.current.isUploading).toBe(true);
	});

	it("sets uid and stops uploading on completion", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({ data: { uid: "uid-1", uploadURL: "https://upload.example.com" } }),
		} as Response);

		const { result } = renderHook(() => useVideoUpload());

		const file = new File(["video-content"], "test.mp4", { type: "video/mp4" });

		act(() => {
			result.current.upload(file);
		});

		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});

		// Simulate load (completion)
		act(() => {
			mockXHRInstance.status = 200;
			mockXHRInstance.responseText = JSON.stringify({ result: { uid: "uid-1" } });
			const loadHandler = mockXHRInstance.addEventListener.mock.calls.find(
				(call) => call[0] === "load",
			)?.[1];
			loadHandler?.();
		});

		expect(result.current.uid).toBe("uid-1");
		expect(result.current.isUploading).toBe(false);
		expect(result.current.progress).toBe(100);
	});

	it("sets error on upload failure", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({ data: { uid: "uid-1", uploadURL: "https://upload.example.com" } }),
		} as Response);

		const { result } = renderHook(() => useVideoUpload());

		const file = new File(["video-content"], "test.mp4", { type: "video/mp4" });

		act(() => {
			result.current.upload(file);
		});

		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});

		// Simulate error
		act(() => {
			const errorHandler = mockXHRInstance.addEventListener.mock.calls.find(
				(call) => call[0] === "error",
			)?.[1];
			errorHandler?.();
		});

		expect(result.current.error).toBe("Upload nie powiódł się");
		expect(result.current.isUploading).toBe(false);
	});

	it("sets error when upload URL fetch fails", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
		} as Response);

		const { result } = renderHook(() => useVideoUpload());

		const file = new File(["video-content"], "test.mp4", { type: "video/mp4" });

		act(() => {
			result.current.upload(file);
		});

		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});

		expect(result.current.error).toBe("Nie udało się uzyskać URL do uploadu");
		expect(result.current.isUploading).toBe(false);
	});

	it("aborts in-flight upload on reset", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({ data: { uid: "uid-1", uploadURL: "https://upload.example.com" } }),
		} as Response);

		const { result } = renderHook(() => useVideoUpload());

		const file = new File(["video-content"], "test.mp4", { type: "video/mp4" });

		act(() => {
			result.current.upload(file);
		});

		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});

		act(() => {
			result.current.reset();
		});

		expect(mockXHRInstance.abort).toHaveBeenCalled();
		expect(result.current.isUploading).toBe(false);
		expect(result.current.uid).toBeNull();
	});
});
