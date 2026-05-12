// SPDX-License-Identifier: AGPL-3.0-or-later
import { createStreamUploadUrl, getStreamThumbnailUrl } from "./client";

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
