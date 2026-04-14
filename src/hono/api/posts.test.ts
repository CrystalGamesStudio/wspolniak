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
}));

import { verifySessionCookie } from "@/db/identity/session";
import {
	countUserPostsToday,
	createPost,
	getPostById,
	listPaginatedPosts,
} from "@/db/posts/queries";
import postsEndpoint from "./posts";

const mockVerify = vi.mocked(verifySessionCookie);
const mockCreatePost = vi.mocked(createPost);
const mockCountToday = vi.mocked(countUserPostsToday);
const mockListPaginated = vi.mocked(listPaginatedPosts);
const mockGetPost = vi.mocked(getPostById);

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
});
