// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/posts/queries", () => ({
	createPost: vi.fn(),
	listRecentPosts: vi.fn(),
	listPaginatedPosts: vi.fn(),
	getPostById: vi.fn(),
	countUserPostsToday: vi.fn(),
	updatePostDescription: vi.fn(),
	softDeletePost: vi.fn(),
}));

vi.mock("@/db/comments/queries", () => ({
	countCommentsByPosts: vi.fn(),
}));

import { countCommentsByPosts } from "@/db/comments/queries";
import { verifySessionCookie } from "@/db/identity/session";
import {
	countUserPostsToday,
	createPost,
	getPostById,
	listPaginatedPosts,
	softDeletePost,
	updatePostDescription,
} from "@/db/posts/queries";
import postsEndpoint from "./posts";

const mockVerify = vi.mocked(verifySessionCookie);
const mockCountComments = vi.mocked(countCommentsByPosts);
const mockCreatePost = vi.mocked(createPost);
const mockCountToday = vi.mocked(countUserPostsToday);
const mockListPaginated = vi.mocked(listPaginatedPosts);
const mockGetPost = vi.mocked(getPostById);
const mockUpdateDescription = vi.mocked(updatePostDescription);
const mockSoftDelete = vi.mocked(softDeletePost);

function createApi() {
	const api = new Hono<{
		Bindings: { SESSION_SECRET: string };
	}>().basePath("/api/app");
	api.route("/posts", postsEndpoint);
	return api;
}

const env = { SESSION_SECRET: "secret" };

function authedRequest(_path: string, init?: RequestInit) {
	return {
		...init,
		headers: { Cookie: "session=valid-jwt", ...init?.headers },
	};
}

describe("POST /api/app/posts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	});

	it("creates post with valid input", async () => {
		mockCountToday.mockResolvedValue(0);
		const now = new Date();
		mockCreatePost.mockResolvedValue({
			post: {
				id: "post-1",
				authorId: "u1",
				description: "Test",
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			},
			images: [
				{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
			],
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			authedRequest("/api/app/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Test", cfImageIds: ["cf-aaa"] }),
			}),
			env,
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("post-1");
		expect(mockCreatePost).toHaveBeenCalledWith({
			authorId: "u1",
			description: "Test",
			cfImageIds: ["cf-aaa"],
		});
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cfImageIds: ["cf-aaa"] }),
			},
			env,
		);

		expect(res.status).toBe(401);
	});

	it("returns 400 when cfImageIds is empty", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			authedRequest("/api/app/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cfImageIds: [] }),
			}),
			env,
		);

		expect(res.status).toBe(400);
	});

	it("returns 400 when more than 10 images", async () => {
		const ids = Array.from({ length: 11 }, (_, i) => `cf-${i}`);
		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			authedRequest("/api/app/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cfImageIds: ids }),
			}),
			env,
		);

		expect(res.status).toBe(400);
	});

	it("returns 400 when description exceeds 2000 chars", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			authedRequest("/api/app/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "x".repeat(2001), cfImageIds: ["cf-aaa"] }),
			}),
			env,
		);

		expect(res.status).toBe(400);
	});

	it("returns 429 when daily post limit exceeded", async () => {
		mockCountToday.mockResolvedValue(50);
		const api = createApi();
		const res = await api.request(
			"/api/app/posts",
			authedRequest("/api/app/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cfImageIds: ["cf-aaa"] }),
			}),
			env,
		);

		expect(res.status).toBe(429);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("limit");
	});
});

describe("GET /api/app/posts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request("/api/app/posts", {}, env);

		expect(res.status).toBe(401);
	});
});

describe("GET /api/app/posts/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	});

	it("returns single post by id", async () => {
		const now = new Date();
		mockGetPost.mockResolvedValue({
			id: "post-1",
			authorId: "u1",
			description: "Test",
			createdAt: now,
			updatedAt: now,
			author: { id: "u1", name: "Tomek" },
			images: [],
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1"),
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string } };
		expect(body.data.id).toBe("post-1");
	});

	it("returns 404 for non-existent post", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/non-existent",
			authedRequest("/api/app/posts/non-existent"),
			env,
		);

		expect(res.status).toBe(404);
	});
});

describe("GET /api/app/posts (paginated)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
		mockCountComments.mockResolvedValue(new Map());
	});

	it("returns first page with nextCursor", async () => {
		const now = new Date();
		mockListPaginated.mockResolvedValue({
			posts: [
				{
					id: "post-1",
					authorId: "u1",
					description: "First",
					createdAt: now,
					updatedAt: now,
					author: { id: "u1", name: "Tomek" },
					images: [],
				},
			],
			nextCursor: { createdAt: now.toISOString(), id: "post-1" },
		});

		const api = createApi();
		const res = await api.request("/api/app/posts", authedRequest("/api/app/posts"), env);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: unknown[];
			meta: { nextCursor: { createdAt: string; id: string } | null };
		};
		expect(body.data).toHaveLength(1);
		expect(body.meta.nextCursor).not.toBeNull();
		expect(body.meta.nextCursor?.id).toBe("post-1");
		expect(mockListPaginated).toHaveBeenCalledWith({ limit: 20, cursor: undefined });
	});

	it("passes cursor from query params to listPaginatedPosts", async () => {
		mockListPaginated.mockResolvedValue({ posts: [], nextCursor: null });

		const api = createApi();
		const res = await api.request(
			"/api/app/posts?cursor=2026-01-01T12:00:00.000Z_post-5",
			authedRequest("/api/app/posts?cursor=2026-01-01T12:00:00.000Z_post-5"),
			env,
		);

		expect(res.status).toBe(200);
		expect(mockListPaginated).toHaveBeenCalledWith({
			limit: 20,
			cursor: { createdAt: "2026-01-01T12:00:00.000Z", id: "post-5" },
		});
	});

	it("returns null nextCursor at end of feed", async () => {
		mockListPaginated.mockResolvedValue({ posts: [], nextCursor: null });

		const api = createApi();
		const res = await api.request("/api/app/posts", authedRequest("/api/app/posts"), env);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { meta: { nextCursor: null } };
		expect(body.meta.nextCursor).toBeNull();
	});

	it("includes commentCount per post in feed response", async () => {
		const now = new Date();
		mockListPaginated.mockResolvedValue({
			posts: [
				{
					id: "post-1",
					authorId: "u1",
					description: "First",
					createdAt: now,
					updatedAt: now,
					author: { id: "u1", name: "Tomek" },
					images: [],
				},
				{
					id: "post-2",
					authorId: "u1",
					description: "Second",
					createdAt: now,
					updatedAt: now,
					author: { id: "u1", name: "Tomek" },
					images: [],
				},
			],
			nextCursor: null,
		});
		mockCountComments.mockResolvedValue(
			new Map([
				["post-1", 3],
				["post-2", 0],
			]),
		);

		const api = createApi();
		const res = await api.request("/api/app/posts", authedRequest("/api/app/posts"), env);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string; commentCount: number }[] };
		expect(body.data[0]?.commentCount).toBe(3);
		expect(body.data[1]?.commentCount).toBe(0);
		expect(mockCountComments).toHaveBeenCalledWith(["post-1", "post-2"]);
	});
});

const now = new Date();
const samplePost = {
	id: "post-1",
	authorId: "u1",
	description: "Stary opis",
	deletedAt: null,
	createdAt: now,
	updatedAt: now,
	author: { id: "u1", name: "Tomek" },
	images: [],
};

describe("PATCH /api/app/posts/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	});

	it("allows author to edit their own post description", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		mockUpdateDescription.mockResolvedValue({ ...samplePost, description: "Nowy opis" });

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Nowy opis" }),
			}),
			env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { description: string } };
		expect(body.data.description).toBe("Nowy opis");
	});

	it("allows admin to edit any post", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Admin", role: "admin" });
		mockGetPost.mockResolvedValue(samplePost);
		mockUpdateDescription.mockResolvedValue({ ...samplePost, description: "Admin edit" });

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Admin edit" }),
			}),
			env,
		);

		expect(res.status).toBe(200);
	});

	it("returns 403 for non-author non-admin member", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Kasia", role: "member" });
		mockGetPost.mockResolvedValue(samplePost);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Hack" }),
			}),
			env,
		);

		expect(res.status).toBe(403);
		expect(mockUpdateDescription).not.toHaveBeenCalled();
	});

	it("returns 404 for non-existent post", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/non-existent",
			authedRequest("/api/app/posts/non-existent", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Test" }),
			}),
			env,
		);

		expect(res.status).toBe(404);
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "Test" }),
			},
			env,
		);

		expect(res.status).toBe(401);
	});

	it("returns 400 when description exceeds 2000 chars", async () => {
		mockGetPost.mockResolvedValue(samplePost);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: "x".repeat(2001) }),
			}),
			env,
		);

		expect(res.status).toBe(400);
	});
});

describe("DELETE /api/app/posts/:id", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "member" });
	});

	it("allows author to delete their own post", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		mockSoftDelete.mockResolvedValue({ ...samplePost, deletedAt: now });

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", { method: "DELETE" }),
			env,
		);

		expect(res.status).toBe(200);
		expect(mockSoftDelete).toHaveBeenCalledWith("post-1");
	});

	it("allows admin to delete any post", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Admin", role: "admin" });
		mockGetPost.mockResolvedValue(samplePost);
		mockSoftDelete.mockResolvedValue({ ...samplePost, deletedAt: now });

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", { method: "DELETE" }),
			env,
		);

		expect(res.status).toBe(200);
	});

	it("returns 403 for non-author non-admin member", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Kasia", role: "member" });
		mockGetPost.mockResolvedValue(samplePost);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1",
			authedRequest("/api/app/posts/post-1", { method: "DELETE" }),
			env,
		);

		expect(res.status).toBe(403);
		expect(mockSoftDelete).not.toHaveBeenCalled();
	});

	it("returns 404 for non-existent post", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/non-existent",
			authedRequest("/api/app/posts/non-existent", { method: "DELETE" }),
			env,
		);

		expect(res.status).toBe(404);
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request("/api/app/posts/post-1", { method: "DELETE" }, env);

		expect(res.status).toBe(401);
	});
});
