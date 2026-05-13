// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
}));

vi.mock("@/db/posts/queries", () => ({
	getVideoById: vi.fn(),
	deletePostVideo: vi.fn(),
	countUserVideoUploadsToday: vi.fn(),
}));

vi.mock("@/stream/client", () => ({
	createStreamUploadUrl: vi.fn(),
	getStreamVideoStatus: vi.fn(),
	deleteStreamVideo: vi.fn(),
}));

import { findActiveUserById } from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { countUserVideoUploadsToday, deletePostVideo, getVideoById } from "@/db/posts/queries";
import { createStreamUploadUrl, deleteStreamVideo, getStreamVideoStatus } from "@/stream/client";
import videosEndpoint from "./videos";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockCreateUpload = vi.mocked(createStreamUploadUrl);
const mockGetStatus = vi.mocked(getStreamVideoStatus);
const _mockGetVideoById = vi.mocked(getVideoById);
const _mockDeletePostVideo = vi.mocked(deletePostVideo);
const _mockDeleteStreamVideo = vi.mocked(deleteStreamVideo);
const _mockCountUserVideoUploadsToday = vi.mocked(countUserVideoUploadsToday);

function createApi() {
	const api = new Hono<{
		Bindings: {
			SESSION_SECRET: string;
			CLOUDFLARE_ACCOUNT_ID: string;
			CLOUDFLARE_STREAM_API_TOKEN: string;
		};
	}>().basePath("/api/app");
	api.route("/videos", videosEndpoint);
	return api;
}

const env = {
	SESSION_SECRET: "secret",
	CLOUDFLARE_ACCOUNT_ID: "acc-1",
	CLOUDFLARE_STREAM_API_TOKEN: "stream-token-1",
};

function setupAuth() {
	mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	mockFindUser.mockResolvedValue({
		id: "u1",
		name: "Tomek",
		role: "member",
		tokenHash: "hash",
		deletedAt: null,
		note: null,
		createdAt: new Date(),
	});
}

describe("POST /api/app/videos/upload-url", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuth();
		_mockCountUserVideoUploadsToday.mockResolvedValue(0); // Under limit by default
	});

	it("returns upload URL for authenticated user", async () => {
		mockCreateUpload.mockResolvedValue({
			uid: "cf-stream-uid-123",
			uploadURL: "https://upload.cloudflarestream.com/abc",
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/upload-url",
			{ method: "POST", headers: { Cookie: "session=valid-jwt" } },
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { uid: string; uploadURL: string } };
		expect(body.data.uid).toBe("cf-stream-uid-123");
		expect(body.data.uploadURL).toBe("https://upload.cloudflarestream.com/abc");
		expect(mockCreateUpload).toHaveBeenCalledWith({
			accountId: "acc-1",
			apiToken: "stream-token-1",
		});
	});

	it("returns 401 without session", async () => {
		const api = createApi();
		const res = await api.request("/api/app/videos/upload-url", { method: "POST" }, env);

		expect(res.status).toBe(401);
	});

	it("returns 429 when daily limit exceeded", async () => {
		_mockCountUserVideoUploadsToday.mockResolvedValue(5); // Already at limit

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/upload-url",
			{ method: "POST", headers: { Cookie: "session=valid-jwt" } },
			env,
		);

		expect(res.status).toBe(429);
		expect(mockCreateUpload).not.toHaveBeenCalled();
	});

	it("allows upload when under daily limit", async () => {
		_mockCountUserVideoUploadsToday.mockResolvedValue(3); // Under limit
		mockCreateUpload.mockResolvedValue({
			uid: "cf-stream-uid-123",
			uploadURL: "https://upload.cloudflarestream.com/abc",
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/upload-url",
			{ method: "POST", headers: { Cookie: "session=valid-jwt" } },
			env,
		);

		expect(res.status).toBe(200);
		expect(_mockCountUserVideoUploadsToday).toHaveBeenCalledWith("u1");
	});
});

describe("GET /api/app/videos/:uid/status", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuth();
	});

	it("returns video processing status for authenticated user", async () => {
		mockGetStatus.mockResolvedValue({
			status: "ready",
			thumbnailUrl: "https://videodelivery.net/uid-1/thumbnails/thumbnail.jpg",
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/uid-1/status",
			{ headers: { Cookie: "session=valid-jwt" } },
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { status: string; thumbnailUrl: string };
		};
		expect(body.data.status).toBe("ready");
		expect(body.data.thumbnailUrl).toBe("https://videodelivery.net/uid-1/thumbnails/thumbnail.jpg");
		expect(mockGetStatus).toHaveBeenCalledWith({
			accountId: "acc-1",
			apiToken: "stream-token-1",
			uid: "uid-1",
		});
	});

	it("returns 401 without session", async () => {
		const api = createApi();
		const res = await api.request("/api/app/videos/uid-1/status", {}, env);

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/app/videos/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupAuth();
	});

	it("author can delete their own video", async () => {
		_mockGetVideoById.mockResolvedValue({
			video: {
				id: "video-1",
				postId: "post-1",
				cfStreamUid: "cf-uid-1",
				displayOrder: 0,
				processingStatus: "ready",
				createdAt: new Date(),
			},
			post: {
				id: "post-1",
				authorId: "u1",
				description: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			},
		});
		_mockDeletePostVideo.mockResolvedValue({
			id: "video-1",
			postId: "post-1",
			cfStreamUid: "cf-uid-1",
			displayOrder: 0,
			processingStatus: "ready",
			createdAt: new Date(),
		});
		_mockDeleteStreamVideo.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/video-1",
			{
				method: "DELETE",
				headers: { Cookie: "session=valid-jwt" },
			},
			env,
		);

		expect(res.status).toBe(200);
		expect(_mockDeletePostVideo).toHaveBeenCalledWith("post-1", "video-1");
		expect(_mockDeleteStreamVideo).toHaveBeenCalledWith({
			accountId: "acc-1",
			apiToken: "stream-token-1",
			uid: "cf-uid-1",
		});
	});

	it("admin can delete any user's video", async () => {
		mockVerify.mockResolvedValue({ userId: "admin-1", name: "Admin", role: "admin" });
		mockFindUser.mockResolvedValue({
			id: "admin-1",
			name: "Admin",
			role: "admin",
			tokenHash: "hash",
			deletedAt: null,
			note: null,
			createdAt: new Date(),
		});

		_mockGetVideoById.mockResolvedValue({
			video: {
				id: "video-1",
				postId: "post-1",
				cfStreamUid: "cf-uid-1",
				displayOrder: 0,
				processingStatus: "ready",
				createdAt: new Date(),
			},
			post: {
				id: "post-1",
				authorId: "u1", // Different from admin
				description: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			},
		});
		_mockDeletePostVideo.mockResolvedValue({
			id: "video-1",
			postId: "post-1",
			cfStreamUid: "cf-uid-1",
			displayOrder: 0,
			processingStatus: "ready",
			createdAt: new Date(),
		});
		_mockDeleteStreamVideo.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/video-1",
			{
				method: "DELETE",
				headers: { Cookie: "session=valid-jwt" },
			},
			env,
		);

		expect(res.status).toBe(200);
	});

	it("non-author non-admin cannot delete videos", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Anna", role: "member" });
		mockFindUser.mockResolvedValue({
			id: "u2",
			name: "Anna",
			role: "member",
			tokenHash: "hash",
			deletedAt: null,
			note: null,
			createdAt: new Date(),
		});

		_mockGetVideoById.mockResolvedValue({
			video: {
				id: "video-1",
				postId: "post-1",
				cfStreamUid: "cf-uid-1",
				displayOrder: 0,
				processingStatus: "ready",
				createdAt: new Date(),
			},
			post: {
				id: "post-1",
				authorId: "u1", // Different from u2
				description: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null,
			},
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/videos/video-1",
			{
				method: "DELETE",
				headers: { Cookie: "session=valid-jwt" },
			},
			env,
		);

		expect(res.status).toBe(403);
		expect(_mockDeletePostVideo).not.toHaveBeenCalled();
		expect(_mockDeleteStreamVideo).not.toHaveBeenCalled();
	});
});
