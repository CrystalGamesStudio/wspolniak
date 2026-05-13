// SPDX-License-Identifier: AGPL-3.0-or-later
import { createStreamUploadUrl, getStreamThumbnailUrl, getStreamVideoStatus } from "./client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createStreamUploadUrl", () => {
	it("calls CF Stream API and returns uid + uploadURL", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					result: {
						uid: "cf-stream-uid-123",
						uploadURL: "https://upload.cloudflarestream.com/abc",
					},
				}),
		});

		const result = await createStreamUploadUrl({
			accountId: "acc-1",
			apiToken: "token-1",
		});

		expect(result.uid).toBe("cf-stream-uid-123");
		expect(result.uploadURL).toBe("https://upload.cloudflarestream.com/abc");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/accounts/acc-1/stream/direct_upload",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer token-1",
				}),
			}),
		);
	});

	it("throws on API error", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 403,
		});

		await expect(
			createStreamUploadUrl({ accountId: "acc-1", apiToken: "bad-token" }),
		).rejects.toThrow("Cloudflare Stream API error: 403");
	});
});

describe("getStreamThumbnailUrl", () => {
	it("returns thumbnail URL for a CF Stream UID", () => {
		const url = getStreamThumbnailUrl("cf-stream-uid-123");
		expect(url).toBe("https://videodelivery.net/cf-stream-uid-123/thumbnails/thumbnail.jpg");
	});
});

describe("getStreamVideoStatus", () => {
	it("returns 'ready' when CF Stream reports ready", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					result: {
						uid: "cf-stream-uid-123",
						status: { state: "ready" },
					},
				}),
		});

		const result = await getStreamVideoStatus({
			accountId: "acc-1",
			apiToken: "token-1",
			uid: "cf-stream-uid-123",
		});

		expect(result).toEqual({
			status: "ready",
			thumbnailUrl: "https://videodelivery.net/cf-stream-uid-123/thumbnails/thumbnail.jpg",
		});
	});

	it("returns 'processing' for inprogress state", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					result: {
						uid: "cf-stream-uid-123",
						status: { state: "inprogress" },
					},
				}),
		});

		const result = await getStreamVideoStatus({
			accountId: "acc-1",
			apiToken: "token-1",
			uid: "cf-stream-uid-123",
		});

		expect(result.status).toBe("processing");
	});

	it("returns 'processing' for queued state", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					result: {
						uid: "cf-stream-uid-123",
						status: { state: "queued" },
					},
				}),
		});

		const result = await getStreamVideoStatus({
			accountId: "acc-1",
			apiToken: "token-1",
			uid: "cf-stream-uid-123",
		});

		expect(result.status).toBe("processing");
	});

	it("returns 'error' when CF Stream reports error", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					result: {
						uid: "cf-stream-uid-123",
						status: { state: "error" },
					},
				}),
		});

		const result = await getStreamVideoStatus({
			accountId: "acc-1",
			apiToken: "token-1",
			uid: "cf-stream-uid-123",
		});

		expect(result.status).toBe("error");
	});

	it("throws on API error", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
		});

		await expect(
			getStreamVideoStatus({ accountId: "acc-1", apiToken: "token-1", uid: "bad-uid" }),
		).rejects.toThrow("Cloudflare Stream API error: 404");
	});
});
