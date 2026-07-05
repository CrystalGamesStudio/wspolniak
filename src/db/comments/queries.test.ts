// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	canAddReply,
	countCommentsByPosts,
	countRepliesByComment,
	createComment,
	createReply,
	getCommentById,
	listCommentsByPost,
	softDeleteComment,
	updateCommentBody,
} from "./queries";
import { comments } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

const now = new Date();

function mockComment(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "comment-1",
		postId: "post-1",
		authorId: "user-1",
		body: "Fajne zdjęcie!",
		parentId: null,
		deletedAt: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("createComment", () => {
	it("inserts comment and returns it", async () => {
		const mock = mockComment();
		const mockReturning = vi.fn().mockResolvedValue([mock]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createComment({
			postId: "post-1",
			authorId: "user-1",
			body: "Fajne zdjęcie!",
		});

		expect(result.postId).toBe("post-1");
		expect(result.authorId).toBe("user-1");
		expect(result.body).toBe("Fajne zdjęcie!");
		expect(mockInsert).toHaveBeenCalledWith(comments);
	});
});

describe("createReply", () => {
	it("inserts reply with parentId and returns it", async () => {
		const mock = mockComment({ id: "reply-1", parentId: "parent-1", body: "Odpowiedź!" });
		const mockReturning = vi.fn().mockResolvedValue([mock]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createReply({
			postId: "post-1",
			parentId: "parent-1",
			authorId: "user-1",
			body: "Odpowiedź!",
		});

		expect(result.id).toBe("reply-1");
		expect(result.parentId).toBe("parent-1");
		expect(result.body).toBe("Odpowiedź!");
		expect(mockInsert).toHaveBeenCalledWith(comments);
		const insertedValues = mockValues.mock.calls[0]?.[0];
		expect(insertedValues).toMatchObject({
			postId: "post-1",
			parentId: "parent-1",
			authorId: "user-1",
			body: "Odpowiedź!",
		});
	});
});

describe("listCommentsByPost", () => {
	function mockSelectChain(mockRows: unknown[]) {
		const mockOrderBy = vi.fn().mockResolvedValue(mockRows);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);
	}

	it("returns top-level comments with authors in chronological order", async () => {
		const older = new Date(now.getTime() - 60_000);
		mockSelectChain([
			{
				comment: mockComment({ id: "c-1", createdAt: older }),
				author: { id: "user-1", name: "Tomek" },
			},
			{
				comment: mockComment({ id: "c-2", authorId: "user-2", createdAt: now }),
				author: { id: "user-2", name: "Kasia" },
			},
		]);

		const result = await listCommentsByPost("post-1");

		expect(result).toHaveLength(2);
		expect(result[0]?.id).toBe("c-1");
		expect(result[0]?.author.name).toBe("Tomek");
		expect(result[0]?.replies).toEqual([]);
		expect(result[1]?.id).toBe("c-2");
		expect(result[1]?.author.name).toBe("Kasia");
		expect(result[1]?.replies).toEqual([]);
	});

	it("groups replies under their parent comment in chronological order", async () => {
		const oldest = new Date(now.getTime() - 120_000);
		const older = new Date(now.getTime() - 60_000);
		mockSelectChain([
			{
				comment: mockComment({ id: "c-1", createdAt: oldest }),
				author: { id: "u1", name: "Tomek" },
			},
			{
				comment: mockComment({ id: "r-1", parentId: "c-1", createdAt: older }),
				author: { id: "u2", name: "Kasia" },
			},
			{
				comment: mockComment({ id: "r-2", parentId: "c-1", createdAt: now }),
				author: { id: "u3", name: "Ania" },
			},
			{ comment: mockComment({ id: "c-2", createdAt: now }), author: { id: "u4", name: "Paweł" } },
		]);

		const result = await listCommentsByPost("post-1");

		expect(result).toHaveLength(2);
		expect(result[0]?.id).toBe("c-1");
		expect(result[0]?.replies).toHaveLength(2);
		expect(result[0]?.replies[0]?.id).toBe("r-1");
		expect(result[0]?.replies[1]?.id).toBe("r-2");
		expect(result[0]?.replies[1]?.author.name).toBe("Ania");
		expect(result[1]?.id).toBe("c-2");
		expect(result[1]?.replies).toEqual([]);
	});

	it("treats an orphan reply (parent deleted) as top-level", async () => {
		mockSelectChain([
			{
				comment: mockComment({ id: "orphan", parentId: "ghost-parent" }),
				author: { id: "u1", name: "Tomek" },
			},
		]);

		const result = await listCommentsByPost("post-1");

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("orphan");
		expect(result[0]?.replies).toEqual([]);
	});

	it("returns empty array when no comments exist", async () => {
		mockSelectChain([]);

		const result = await listCommentsByPost("post-1");

		expect(result).toEqual([]);
	});
});

describe("getCommentById", () => {
	function mockSelectChain(mockRows: unknown[]) {
		const mockWhere = vi.fn().mockResolvedValue(mockRows);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);
	}

	it("returns comment for valid id", async () => {
		mockSelectChain([mockComment()]);

		const result = await getCommentById("comment-1");

		expect(result).not.toBeNull();
		expect(result?.id).toBe("comment-1");
		expect(result?.body).toBe("Fajne zdjęcie!");
	});

	it("returns null for non-existent comment", async () => {
		mockSelectChain([]);

		const result = await getCommentById("non-existent");

		expect(result).toBeNull();
	});
});

describe("updateCommentBody", () => {
	function mockUpdateChain(returnedRows: unknown[]) {
		const mockReturning = vi.fn().mockResolvedValue(returnedRows);
		const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
		const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
		mockGetDb.mockReturnValue({ update: mockUpdate } as never);
	}

	it("updates body and returns the updated comment", async () => {
		mockUpdateChain([mockComment({ body: "Zmieniony komentarz" })]);

		const result = await updateCommentBody("comment-1", "Zmieniony komentarz");

		expect(result).not.toBeNull();
		expect(result?.body).toBe("Zmieniony komentarz");
	});

	it("returns null when comment does not exist", async () => {
		mockUpdateChain([]);

		const result = await updateCommentBody("non-existent", "Coś");

		expect(result).toBeNull();
	});
});

describe("softDeleteComment", () => {
	function mockUpdateChain(returnedRows: unknown[]) {
		const mockReturning = vi.fn().mockResolvedValue(returnedRows);
		const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
		const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
		mockGetDb.mockReturnValue({ update: mockUpdate } as never);
	}

	it("sets deletedAt and returns the deleted comment", async () => {
		mockUpdateChain([mockComment({ deletedAt: now })]);

		const result = await softDeleteComment("comment-1");

		expect(result).not.toBeNull();
		expect(result?.deletedAt).toBeTruthy();
	});

	it("returns null when comment does not exist", async () => {
		mockUpdateChain([]);

		const result = await softDeleteComment("non-existent");

		expect(result).toBeNull();
	});

	it("cascades: soft-deletes the comment and its replies", async () => {
		const replyWhere = vi.fn().mockResolvedValue(undefined);
		const replySet = vi.fn().mockReturnValue({ where: replyWhere });
		const mockReturning = vi.fn().mockResolvedValue([mockComment({ deletedAt: now })]);
		const parentWhere = vi.fn().mockReturnValue({ returning: mockReturning });
		const parentSet = vi.fn().mockReturnValue({ where: parentWhere });
		const mockUpdate = vi
			.fn()
			.mockReturnValueOnce({ set: replySet })
			.mockReturnValueOnce({ set: parentSet });
		mockGetDb.mockReturnValue({ update: mockUpdate } as never);

		const result = await softDeleteComment("comment-1");

		expect(result?.deletedAt).toBeTruthy();
		expect(mockUpdate).toHaveBeenCalledTimes(2);
		expect(replyWhere).toHaveBeenCalled();
	});
});

describe("countRepliesByComment", () => {
	function mockCountChain(rows: unknown[]) {
		const mockWhere = vi.fn().mockResolvedValue(rows);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);
	}

	it("returns the number of replies for a given parent", async () => {
		mockCountChain([{ count: 3 }]);

		const result = await countRepliesByComment("parent-1");

		expect(result).toBe(3);
	});

	it("returns 0 when no replies exist", async () => {
		mockCountChain([{ count: 0 }]);

		const result = await countRepliesByComment("parent-1");

		expect(result).toBe(0);
	});

	it("returns 0 when the count row is missing", async () => {
		mockCountChain([]);

		const result = await countRepliesByComment("parent-1");

		expect(result).toBe(0);
	});
});

describe("countCommentsByPosts", () => {
	it("returns counts keyed by postId", async () => {
		const mockGroupBy = vi.fn().mockResolvedValue([
			{ postId: "post-1", count: 3 },
			{ postId: "post-2", count: 1 },
		]);
		const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await countCommentsByPosts(["post-1", "post-2"]);

		expect(result.get("post-1")).toBe(3);
		expect(result.get("post-2")).toBe(1);
	});

	it("returns empty map for empty input", async () => {
		const result = await countCommentsByPosts([]);

		expect(result.size).toBe(0);
	});

	it("returns empty map when no comments exist for given posts", async () => {
		const mockGroupBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await countCommentsByPosts(["post-99"]);

		expect(result.size).toBe(0);
	});
});

describe("canAddReply", () => {
	it("allows reply when current reply count is below the max", () => {
		expect(canAddReply(0)).toBe(true);
		expect(canAddReply(4)).toBe(true);
	});

	it("forbids reply when the max (5) is reached or exceeded", () => {
		expect(canAddReply(5)).toBe(false);
		expect(canAddReply(6)).toBe(false);
	});
});
