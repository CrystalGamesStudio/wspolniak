// SPDX-License-Identifier: AGPL-3.0-or-later
import { createMentions, deleteMentionsByPost } from "./queries";
import { mentions } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

const now = new Date();

function mentionRow(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "mention-1",
		postId: "post-1",
		commentId: "comment-1",
		userId: "u-1",
		createdAt: now,
		...overrides,
	};
}

describe("createMentions", () => {
	it("inserts one row per userId and returns them", async () => {
		const mockReturning = vi
			.fn()
			.mockResolvedValue([
				mentionRow({ id: "m-1", userId: "u-ania" }),
				mentionRow({ id: "m-2", userId: "u-andrzej" }),
			]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createMentions({
			postId: "post-1",
			commentId: "comment-1",
			userIds: ["u-ania", "u-andrzej"],
		});

		expect(result).toHaveLength(2);
		expect(mockInsert).toHaveBeenCalledWith(mentions);
		const insertedRows = mockValues.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(insertedRows).toHaveLength(2);
		expect(insertedRows[0]).toMatchObject({
			postId: "post-1",
			commentId: "comment-1",
			userId: "u-ania",
		});
		expect(insertedRows[1]).toMatchObject({ userId: "u-andrzej" });
	});

	it("deduplicates userIds before inserting", async () => {
		const mockReturning = vi.fn().mockResolvedValue([mentionRow({ userId: "u-ania" })]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		await createMentions({
			postId: "post-1",
			commentId: "comment-1",
			userIds: ["u-ania", "u-ania", "u-ania"],
		});

		const insertedRows = mockValues.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(insertedRows).toHaveLength(1);
	});

	it("returns empty array and skips DB call when no userIds", async () => {
		const mockInsert = vi.fn();
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createMentions({ postId: "post-1", commentId: "comment-1", userIds: [] });

		expect(result).toEqual([]);
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("accepts null commentId for post-level mentions", async () => {
		const mockReturning = vi
			.fn()
			.mockResolvedValue([mentionRow({ id: "m-1", commentId: null, userId: "u-ania" })]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		await createMentions({ postId: "post-1", commentId: null, userIds: ["u-ania"] });

		const insertedRows = mockValues.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
		expect(insertedRows[0]).toMatchObject({ postId: "post-1", commentId: null, userId: "u-ania" });
	});
});

describe("deleteMentionsByPost", () => {
	it("deletes all mentions belonging to a post", async () => {
		const mockWhere = vi.fn().mockResolvedValue(undefined);
		const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
		mockGetDb.mockReturnValue({ delete: mockDelete } as never);

		await deleteMentionsByPost("post-1");

		expect(mockDelete).toHaveBeenCalledWith(mentions);
		expect(mockWhere).toHaveBeenCalled();
	});
});
