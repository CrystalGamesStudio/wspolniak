// SPDX-License-Identifier: AGPL-3.0-or-later
import { createDirectUploadUrl, createDirectUploadUrlBatch, getImageUrl } from "./client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
	vi.restoreAllMocks();
	// vi.restoreAllMocks nie czyści historii wywołań dla vi.fn() (działa tylko dla spyOn),
	// więc licznik mockFetch kumulowałby się między testami — czyścimy ręcznie.
	mockFetch.mockClear();
});

function cfResponse(id: string) {
	return {
		ok: true,
		json: () =>
			Promise.resolve({
				success: true,
				result: { id, uploadURL: `https://upload/${id}` },
			}),
	};
}

describe("createDirectUploadUrl", () => {
	it("calls CF Images API and returns uploadURL + cfImageId", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					success: true,
					result: {
						id: "cf-img-123",
						uploadURL: "https://upload.imagedelivery.net/abc/cf-img-123",
					},
				}),
		});

		const result = await createDirectUploadUrl({
			accountId: "acc-1",
			apiToken: "token-1",
		});

		expect(result.cfImageId).toBe("cf-img-123");
		expect(result.uploadURL).toBe("https://upload.imagedelivery.net/abc/cf-img-123");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.cloudflare.com/client/v4/accounts/acc-1/images/v2/direct_upload",
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
			text: () => Promise.resolve("Forbidden"),
		});

		await expect(
			createDirectUploadUrl({ accountId: "acc-1", apiToken: "bad-token" }),
		).rejects.toThrow("Cloudflare Images API error: 403");
	});
});

describe("createDirectUploadUrlBatch", () => {
	it("returns N unique upload pairs and calls CF API N times for count N", async () => {
		mockFetch
			.mockResolvedValueOnce(cfResponse("img-1"))
			.mockResolvedValueOnce(cfResponse("img-2"))
			.mockResolvedValueOnce(cfResponse("img-3"));

		const result = await createDirectUploadUrlBatch({ accountId: "acc-1", apiToken: "token-1" }, 3);

		expect(result).toHaveLength(3);
		expect(mockFetch).toHaveBeenCalledTimes(3);
		for (const pair of result) {
			expect(pair.cfImageId).toMatch(/^img-/);
			expect(pair.uploadURL).toBe(`https://upload/${pair.cfImageId}`);
		}
		expect(new Set(result.map((p) => p.cfImageId)).size).toBe(3);
	});

	it("returns [] and does not call CF API for count 0", async () => {
		const result = await createDirectUploadUrlBatch({ accountId: "acc-1", apiToken: "token-1" }, 0);

		expect(result).toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("propagates CF API error when any pair fails", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: () => Promise.resolve("boom"),
		});

		await expect(
			createDirectUploadUrlBatch({ accountId: "acc-1", apiToken: "token-1" }, 2),
		).rejects.toThrow("Cloudflare Images API error: 500");
	});
});

describe("getImageUrl", () => {
	it("returns delivery URL for given variant", () => {
		const url = getImageUrl({
			accountHash: "abc123hash",
			cfImageId: "cf-img-456",
			variant: "thumbnail",
		});

		expect(url).toBe("https://imagedelivery.net/abc123hash/cf-img-456/thumbnail");
	});

	it("defaults to public variant", () => {
		const url = getImageUrl({
			accountHash: "abc123hash",
			cfImageId: "cf-img-456",
		});

		expect(url).toBe("https://imagedelivery.net/abc123hash/cf-img-456/public");
	});
});
