// SPDX-License-Identifier: AGPL-3.0-or-later
import { getReactionCounts, getUserReaction, upsertReaction } from "./queries";
import { postReactions } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

const now = new Date();

function mockReaction(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "reaction-1",
		postId: "post-1",
		userId: "user-1",
		reactionType: "heart" as const,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("upsertReaction", () => {
	it("inserts new reaction and returns it", async () => {
		const expected = mockReaction();
		const mockReturning = vi.fn().mockResolvedValue([expected]);
		const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await upsertReaction({
			postId: "post-1",
			userId: "user-1",
			reactionType: "heart",
		});

		expect(result.reactionType).toBe("heart");
		expect(result.postId).toBe("post-1");
		expect(result.userId).toBe("user-1");
		expect(mockInsert).toHaveBeenCalledWith(postReactions);
		expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				target: expect.arrayContaining([postReactions.postId, postReactions.userId]),
			}),
		);
	});

	it("updates existing reaction on conflict", async () => {
		const updated = mockReaction({ reactionType: "thumbs_up", updatedAt: new Date() });
		const mockReturning = vi.fn().mockResolvedValue([updated]);
		const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await upsertReaction({
			postId: "post-1",
			userId: "user-1",
			reactionType: "thumbs_up",
		});

		expect(result.reactionType).toBe("thumbs_up");
		expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				set: expect.objectContaining({ reactionType: "thumbs_up" }),
			}),
		);
	});
});

describe("getReactionCounts", () => {
	it("returns counts grouped by reaction type", async () => {
		const mockGroupBy = vi.fn().mockResolvedValue([
			{ reactionType: "heart", count: 5 },
			{ reactionType: "thumbs_up", count: 3 },
			{ reactionType: "laugh", count: 1 },
		]);
		const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await getReactionCounts("post-1");

		expect(result.get("heart")).toBe(5);
		expect(result.get("thumbs_up")).toBe(3);
		expect(result.get("laugh")).toBe(1);
	});

	it("returns empty map when no reactions exist", async () => {
		const mockGroupBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await getReactionCounts("post-1");

		expect(result.size).toBe(0);
	});
});

describe("getUserReaction", () => {
	function mockSelectChain(mockRows: unknown[]) {
		const mockWhere = vi.fn().mockResolvedValue(mockRows);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);
	}

	it("returns user reaction for a post", async () => {
		mockSelectChain([mockReaction()]);

		const result = await getUserReaction("post-1", "user-1");

		expect(result).not.toBeNull();
		expect(result?.reactionType).toBe("heart");
	});

	it("returns null when user has not reacted", async () => {
		mockSelectChain([]);

		const result = await getUserReaction("post-1", "user-1");

		expect(result).toBeNull();
	});
});
