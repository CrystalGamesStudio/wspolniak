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
	getPostById: vi.fn(),
}));

vi.mock("@/db/post-reactions/queries", () => ({
	upsertReaction: vi.fn(),
	getReactionCounts: vi.fn(),
	getUserReaction: vi.fn(),
}));

import { findActiveUserById } from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { getReactionCounts, getUserReaction, upsertReaction } from "@/db/post-reactions/queries";
import { getPostById } from "@/db/posts/queries";
import reactionsEndpoint from "./post-reactions";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockGetPost = vi.mocked(getPostById);
const mockUpsertReaction = vi.mocked(upsertReaction);
const mockGetReactionCounts = vi.mocked(getReactionCounts);
const mockGetUserReaction = vi.mocked(getUserReaction);

function createApi() {
	const api = new Hono<{
		Bindings: { SESSION_SECRET: string };
	}>().basePath("/api/app");
	api.route("/posts", reactionsEndpoint);
	return api;
}

const env = { SESSION_SECRET: "secret" };

function authedRequest(_path: string, init?: RequestInit) {
	return {
		...init,
		headers: { Cookie: "session=valid-jwt", ...init?.headers },
	};
}

const now = new Date();
const samplePost = {
	id: "post-1",
	authorId: "u1",
	description: "Test",
	createdAt: now,
	updatedAt: now,
	author: { id: "u1", name: "Tomek" },
	images: [],
};

const sampleReaction = {
	id: "reaction-1",
	postId: "post-1",
	userId: "u1",
	reactionType: "heart" as const,
	createdAt: now,
	updatedAt: now,
};

describe("POST /api/app/posts/:postId/reactions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
	});

	it("creates reaction with valid input", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		mockUpsertReaction.mockResolvedValue(sampleReaction);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1/reactions",
			authedRequest("/api/app/posts/post-1/reactions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reactionType: "heart" }),
			}),
			env,
		);

		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { id: string } };
		expect(json.data.id).toBe("reaction-1");
		expect(mockUpsertReaction).toHaveBeenCalledWith({
			postId: "post-1",
			userId: "u1",
			reactionType: "heart",
		});
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1/reactions",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reactionType: "heart" }),
			},
			env,
		);

		expect(res.status).toBe(401);
	});

	it("returns 404 when post does not exist", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/non-existent/reactions",
			authedRequest("/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reactionType: "heart" }),
			}),
			env,
		);

		expect(res.status).toBe(404);
	});

	it("returns 400 for invalid reaction type", async () => {
		mockGetPost.mockResolvedValue(samplePost);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/post-1/reactions",
			authedRequest("/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reactionType: "invalid" }),
			}),
			env,
		);

		expect(res.status).toBe(400);
	});
});

describe("GET /api/app/posts/:postId/reactions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
	});

	it("returns reaction counts for a post", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		const counts = new Map([
			["heart" as const, 5],
			["thumbs_up" as const, 3],
		]);
		mockGetReactionCounts.mockResolvedValue(counts);

		const api = createApi();
		const res = await api.request("/api/app/posts/post-1/reactions", authedRequest("/"), env);

		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: Record<string, number> };
		expect(json.data.heart).toBe(5);
		expect(json.data.thumbs_up).toBe(3);
	});

	it("returns 404 when post does not exist", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request("/api/app/posts/non-existent/reactions", authedRequest("/"), env);

		expect(res.status).toBe(404);
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request("/api/app/posts/post-1/reactions", {}, env);

		expect(res.status).toBe(401);
	});
});

describe("GET /api/app/posts/:postId/my-reaction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
	});

	it("returns user reaction when it exists", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		mockGetUserReaction.mockResolvedValue(sampleReaction);

		const api = createApi();
		const res = await api.request("/api/app/posts/post-1/my-reaction", authedRequest("/"), env);

		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: { reactionType: string } };
		expect(json.data.reactionType).toBe("heart");
	});

	it("returns null when user has not reacted", async () => {
		mockGetPost.mockResolvedValue(samplePost);
		mockGetUserReaction.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request("/api/app/posts/post-1/my-reaction", authedRequest("/"), env);

		expect(res.status).toBe(200);
		const json = (await res.json()) as { data: null };
		expect(json.data).toBeNull();
	});

	it("returns 404 when post does not exist", async () => {
		mockGetPost.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/app/posts/non-existent/my-reaction",
			authedRequest("/"),
			env,
		);

		expect(res.status).toBe(404);
	});

	it("returns 401 without session", async () => {
		mockVerify.mockResolvedValue(null);
		const api = createApi();
		const res = await api.request("/api/app/posts/post-1/my-reaction", {}, env);

		expect(res.status).toBe(401);
	});
});
