// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
}));

vi.mock("@/images/client", () => ({
	createDirectUploadUrl: vi.fn(),
}));

import { findActiveUserById } from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { createDirectUploadUrl } from "@/images/client";
import imagesEndpoint from "./images";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockCreateUpload = vi.mocked(createDirectUploadUrl);

function createApi() {
	const api = new Hono<{
		Bindings: {
			SESSION_SECRET: string;
			CLOUDFLARE_ACCOUNT_ID: string;
			CLOUDFLARE_IMAGES_API_TOKEN: string;
			CLOUDFLARE_IMAGES_ACCOUNT_HASH: string;
		};
	}>().basePath("/api/app");
	api.route("/images", imagesEndpoint);
	return api;
}

const env = {
	SESSION_SECRET: "secret",
	CLOUDFLARE_ACCOUNT_ID: "acc-1",
	CLOUDFLARE_IMAGES_API_TOKEN: "token-1",
	CLOUDFLARE_IMAGES_ACCOUNT_HASH: "hash-1",
};

describe("POST /api/app/images/upload-url", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns upload URL for authenticated user", async () => {
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
		mockFindUser.mockResolvedValue({
			id: "u1",
			name: "Tomek",
			role: "member",
			tokenHash: "hash",
			deletedAt: null,
			createdAt: new Date(),
		});
		mockCreateUpload.mockResolvedValue({
			cfImageId: "cf-img-123",
			uploadURL: "https://upload.imagedelivery.net/abc/cf-img-123",
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/images/upload-url",
			{ method: "POST", headers: { Cookie: "session=valid-jwt" } },
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { cfImageId: string; uploadURL: string } };
		expect(body.data.cfImageId).toBe("cf-img-123");
		expect(body.data.uploadURL).toBe("https://upload.imagedelivery.net/abc/cf-img-123");
	});

	it("returns 401 without session", async () => {
		const api = createApi();
		const res = await api.request("/api/app/images/upload-url", { method: "POST" }, env);

		expect(res.status).toBe(401);
	});
});
