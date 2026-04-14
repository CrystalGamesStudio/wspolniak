import {
	countUserPostsToday,
	createPost,
	getPostById,
	listPaginatedPosts,
	listRecentPosts,
	softDeletePost,
	updatePostDescription,
} from "./queries";
import { postImages, posts } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

function mockDbWithInsert(tableResults: Map<unknown, { rows: unknown[] }>) {
	const mockInsert = vi.fn().mockImplementation((table) => {
		const result = tableResults.get(table);
		if (!result) throw new Error("Unexpected table in insert");
		const mockReturning = vi.fn().mockResolvedValue(result.rows);
		return { values: vi.fn().mockReturnValue({ returning: mockReturning }) };
	});
	mockGetDb.mockReturnValue({ insert: mockInsert } as never);
}

describe("createPost", () => {
	it("inserts post and images and returns the post with images", async () => {
		const now = new Date();
		const mockPost = {
			id: "post-1",
			authorId: "user-1",
			description: "Wakacje nad morzem",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		const mockImageRows = [
			{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
			{ id: "img-2", postId: "post-1", cfImageId: "cf-bbb", displayOrder: 1, createdAt: now },
		];

		mockDbWithInsert(
			new Map<unknown, { rows: unknown[] }>([
				[posts, { rows: [mockPost] }],
				[postImages, { rows: mockImageRows }],
			]),
		);

		const result = await createPost({
			authorId: "user-1",
			description: "Wakacje nad morzem",
			cfImageIds: ["cf-aaa", "cf-bbb"],
		});

		expect(result.post.authorId).toBe("user-1");
		expect(result.post.description).toBe("Wakacje nad morzem");
		expect(result.images).toHaveLength(2);
		expect(result.images[0]?.cfImageId).toBe("cf-aaa");
		expect(result.images[1]?.cfImageId).toBe("cf-bbb");
	});

	it("creates post with empty description", async () => {
		const now = new Date();
		const mockPost = {
			id: "post-2",
			authorId: "user-1",
			description: null,
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		const mockImageRows = [
			{ id: "img-3", postId: "post-2", cfImageId: "cf-ccc", displayOrder: 0, createdAt: now },
		];

		mockDbWithInsert(
			new Map<unknown, { rows: unknown[] }>([
				[posts, { rows: [mockPost] }],
				[postImages, { rows: mockImageRows }],
			]),
		);

		const result = await createPost({
			authorId: "user-1",
			description: null,
			cfImageIds: ["cf-ccc"],
		});

		expect(result.post.description).toBeNull();
		expect(result.images).toHaveLength(1);
	});
});

describe("listRecentPosts", () => {
	it("returns posts in reverse chronological order with author and images", async () => {
		const now = new Date();
		const older = new Date(now.getTime() - 60_000);

		const mockRows = [
			{
				post: {
					id: "post-2",
					authorId: "user-1",
					description: "Nowy",
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
				author: { id: "user-1", name: "Tomek" },
				image: {
					id: "img-2",
					postId: "post-2",
					cfImageId: "cf-bbb",
					displayOrder: 0,
					createdAt: now,
				},
			},
			{
				post: {
					id: "post-1",
					authorId: "user-1",
					description: "Stary",
					deletedAt: null,
					createdAt: older,
					updatedAt: older,
				},
				author: { id: "user-1", name: "Tomek" },
				image: {
					id: "img-1",
					postId: "post-1",
					cfImageId: "cf-aaa",
					displayOrder: 0,
					createdAt: older,
				},
			},
		];

		const mockLimit = vi.fn().mockResolvedValue(mockRows);
		const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
		const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await listRecentPosts(50);

		expect(result).toHaveLength(2);
		expect(result[0]?.id).toBe("post-2");
		expect(result[0]?.author.name).toBe("Tomek");
		expect(result[0]?.images).toHaveLength(1);
		expect(result[1]?.id).toBe("post-1");
	});

	it("groups multiple images under the same post", async () => {
		const now = new Date();

		const mockRows = [
			{
				post: {
					id: "post-1",
					authorId: "user-1",
					description: "Multi",
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
				author: { id: "user-1", name: "Kasia" },
				image: {
					id: "img-1",
					postId: "post-1",
					cfImageId: "cf-aaa",
					displayOrder: 0,
					createdAt: now,
				},
			},
			{
				post: {
					id: "post-1",
					authorId: "user-1",
					description: "Multi",
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
				author: { id: "user-1", name: "Kasia" },
				image: {
					id: "img-2",
					postId: "post-1",
					cfImageId: "cf-bbb",
					displayOrder: 1,
					createdAt: now,
				},
			},
		];

		const mockLimit = vi.fn().mockResolvedValue(mockRows);
		const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
		const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await listRecentPosts(50);

		expect(result).toHaveLength(1);
		expect(result[0]?.images).toHaveLength(2);
		expect(result[0]?.images[0]?.cfImageId).toBe("cf-aaa");
		expect(result[0]?.images[1]?.cfImageId).toBe("cf-bbb");
	});

	it("returns empty array when no posts exist", async () => {
		const mockLimit = vi.fn().mockResolvedValue([]);
		const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
		const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await listRecentPosts(50);

		expect(result).toEqual([]);
	});
});

describe("getPostById", () => {
	it("returns post with author and images for valid id", async () => {
		const now = new Date();
		const mockRows = [
			{
				post: {
					id: "post-1",
					authorId: "user-1",
					description: "Test",
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
				author: { id: "user-1", name: "Tomek" },
				image: {
					id: "img-1",
					postId: "post-1",
					cfImageId: "cf-aaa",
					displayOrder: 0,
					createdAt: now,
				},
			},
			{
				post: {
					id: "post-1",
					authorId: "user-1",
					description: "Test",
					deletedAt: null,
					createdAt: now,
					updatedAt: now,
				},
				author: { id: "user-1", name: "Tomek" },
				image: {
					id: "img-2",
					postId: "post-1",
					cfImageId: "cf-bbb",
					displayOrder: 1,
					createdAt: now,
				},
			},
		];

		const mockWhere = vi.fn().mockResolvedValue(mockRows);
		const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
		const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await getPostById("post-1");

		expect(result).not.toBeNull();
		expect(result?.id).toBe("post-1");
		expect(result?.author.name).toBe("Tomek");
		expect(result?.images).toHaveLength(2);
	});

	it("returns null for non-existent post", async () => {
		const mockWhere = vi.fn().mockResolvedValue([]);
		const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
		const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await getPostById("non-existent");

		expect(result).toBeNull();
	});
});

describe("countUserPostsToday", () => {
	it("returns count of posts created today by user", async () => {
		const mockWhere = vi.fn().mockResolvedValue([{ count: 5 }]);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await countUserPostsToday("user-1");

		expect(result).toBe(5);
	});

	it("returns 0 when user has no posts today", async () => {
		const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await countUserPostsToday("user-1");

		expect(result).toBe(0);
	});
});

function mockSelectChain(mockRows: unknown[]) {
	const mockLimit = vi.fn().mockResolvedValue(mockRows);
	const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
	const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
	const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
	const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
	const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	mockGetDb.mockReturnValue({ select: mockSelect } as never);
}

function _makePostRow(id: string, authorName: string, createdAt: Date, imageId?: string) {
	return {
		post: {
			id,
			authorId: "user-1",
			description: `Post ${id}`,
			deletedAt: null,
			createdAt,
			updatedAt: createdAt,
		},
		author: { id: "user-1", name: authorName },
		image: imageId
			? { id: imageId, postId: id, cfImageId: `cf-${imageId}`, displayOrder: 0, createdAt }
			: null,
	};
}

describe("listPaginatedPosts", () => {
	it("returns empty posts and null cursor for empty feed", async () => {
		mockSelectChain([]);

		const result = await listPaginatedPosts({ limit: 20 });

		expect(result.posts).toEqual([]);
		expect(result.nextCursor).toBeNull();
	});

	it("returns all posts and null cursor when fewer than limit", async () => {
		const now = new Date();
		const older = new Date(now.getTime() - 60_000);
		mockSelectChain([
			_makePostRow("post-2", "Tomek", now, "img-2"),
			_makePostRow("post-1", "Tomek", older, "img-1"),
		]);

		const result = await listPaginatedPosts({ limit: 20 });

		expect(result.posts).toHaveLength(2);
		expect(result.posts[0]?.id).toBe("post-2");
		expect(result.posts[1]?.id).toBe("post-1");
		expect(result.nextCursor).toBeNull();
	});

	it("returns nextCursor when exactly limit+1 rows exist", async () => {
		const base = new Date("2026-01-01T12:00:00Z");
		// limit=2, so we need 3 rows (limit+1) to signal hasMore
		const rows = [
			_makePostRow("post-3", "Kasia", new Date(base.getTime() - 0), "img-3"),
			_makePostRow("post-2", "Kasia", new Date(base.getTime() - 1000), "img-2"),
			_makePostRow("post-1", "Kasia", new Date(base.getTime() - 2000), "img-1"),
		];
		mockSelectChain(rows);

		const result = await listPaginatedPosts({ limit: 2 });

		expect(result.posts).toHaveLength(2);
		expect(result.posts[0]?.id).toBe("post-3");
		expect(result.posts[1]?.id).toBe("post-2");
		expect(result.nextCursor).not.toBeNull();
		expect(result.nextCursor?.id).toBe("post-2");
	});

	it("returns null cursor at exact boundary (posts === limit)", async () => {
		const base = new Date("2026-01-01T12:00:00Z");
		// limit=2, exactly 2 rows — no extra row means no more pages
		const rows = [
			_makePostRow("post-2", "Kasia", new Date(base.getTime() - 0), "img-2"),
			_makePostRow("post-1", "Kasia", new Date(base.getTime() - 1000), "img-1"),
		];
		mockSelectChain(rows);

		const result = await listPaginatedPosts({ limit: 2 });

		expect(result.posts).toHaveLength(2);
		expect(result.nextCursor).toBeNull();
	});

	it("groups multiple images under the same post in paginated results", async () => {
		const now = new Date();
		// Two rows for the same post (two images)
		const rows = [
			_makePostRow("post-1", "Tomek", now, "img-1"),
			{ ..._makePostRow("post-1", "Tomek", now, "img-2") },
		];
		mockSelectChain(rows);

		const result = await listPaginatedPosts({ limit: 20 });

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0]?.images).toHaveLength(2);
	});
});

function mockUpdateChain(returnedRows: unknown[]) {
	const mockReturning = vi.fn().mockResolvedValue(returnedRows);
	const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
	const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
	mockGetDb.mockReturnValue({ update: mockUpdate } as never);
}

describe("updatePostDescription", () => {
	it("updates description and returns the updated post", async () => {
		const now = new Date();
		const updatedPost = {
			id: "post-1",
			authorId: "user-1",
			description: "Nowy opis",
			deletedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		mockUpdateChain([updatedPost]);

		const result = await updatePostDescription("post-1", "Nowy opis");

		expect(result).not.toBeNull();
		expect(result?.description).toBe("Nowy opis");
	});

	it("returns null when post does not exist", async () => {
		mockUpdateChain([]);

		const result = await updatePostDescription("non-existent", "Coś");

		expect(result).toBeNull();
	});
});

describe("softDeletePost", () => {
	it("sets deletedAt and returns the deleted post", async () => {
		const now = new Date();
		const deletedPost = {
			id: "post-1",
			authorId: "user-1",
			description: "Test",
			deletedAt: now,
			createdAt: now,
			updatedAt: now,
		};
		mockUpdateChain([deletedPost]);

		const result = await softDeletePost("post-1");

		expect(result).not.toBeNull();
		expect(result?.deletedAt).toBeTruthy();
	});

	it("returns null when post does not exist", async () => {
		mockUpdateChain([]);

		const result = await softDeletePost("non-existent");

		expect(result).toBeNull();
	});
});
