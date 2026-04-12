import { createDirectUploadUrl, getImageUrl } from "./client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(() => {
	vi.restoreAllMocks();
});

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
