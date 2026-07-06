// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import type { pinnedPosts } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

const now = new Date();

function mockPinned(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "pin-1",
		postId: "post-1",
		pinnedAt: now,
		...overrides,
	};
}

type PinnedRow = InferSelectModel<typeof pinnedPosts>;

function mockInsertChain(returningRows: PinnedRow[]) {
	const mockReturning = vi.fn().mockResolvedValue(returningRows);
	const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
	mockGetDb.mockReturnValue({ insert: mockInsert } as never);
	return { mockInsert, mockValues };
}

// pinPost calls countPinnedPosts() (getDb #1: select count) before insert (getDb #2: insert chain).
function mockCountThenInsert(countVal: number, returningRows: PinnedRow[]) {
	const { mockValues } = mockInsertChain(returningRows);
	const countFrom = vi.fn().mockResolvedValue([{ count: countVal }]);
	const countSelect = vi.fn().mockReturnValue({ from: countFrom });
	mockGetDb
		.mockReturnValueOnce({ select: countSelect } as never)
		.mockReturnValueOnce({ insert: vi.fn().mockReturnValue({ values: mockValues }) } as never);
	return { mockValues };
}

function mockSelectChain(rows: unknown[]) {
	const mockLimit = vi.fn().mockResolvedValue(rows);
	const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
	const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	mockGetDb.mockReturnValue({ select: mockSelect } as never);
	return { mockSelect, mockFrom, mockOrderBy };
}

function mockDeleteChain(returningRows: PinnedRow[]) {
	const mockReturning = vi.fn().mockResolvedValue(returningRows);
	const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
	mockGetDb.mockReturnValue({ delete: mockDelete } as never);
	return { mockDelete, mockWhere };
}

describe("pinPost", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("inserts a pinned_posts row for the given postId", async () => {
		const { mockValues } = mockCountThenInsert(0, [mockPinned()]);
		const { pinPost } = await import("./queries");

		const result = await pinPost("post-1");

		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ postId: "post-1" }));
		expect(result.postId).toBe("post-1");
	});
});

describe("unpinPost", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deletes the pinned_posts row for the given postId and returns it", async () => {
		const { mockWhere } = mockDeleteChain([mockPinned()]);
		const { unpinPost } = await import("./queries");

		const result = await unpinPost("post-1");

		expect(mockWhere).toHaveBeenCalled();
		expect(result?.postId).toBe("post-1");
	});

	it("returns null when nothing was pinned for that postId", async () => {
		mockDeleteChain([]);
		const { unpinPost } = await import("./queries");

		const result = await unpinPost("post-1");

		expect(result).toBeNull();
	});
});

function mockCountSelect(countVal: number) {
	const mockFrom = vi.fn().mockResolvedValue([{ count: countVal }]);
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	mockGetDb.mockReturnValue({ select: mockSelect } as never);
}

describe("countPinnedPosts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the count of pinned posts", async () => {
		mockCountSelect(2);
		const { countPinnedPosts } = await import("./queries");

		const result = await countPinnedPosts();

		expect(result).toBe(2);
	});
});

describe("listPinnedPostIds", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns postIds ordered by pinned_at DESC, capped at 3", async () => {
		mockSelectChain([{ postId: "post-1" }, { postId: "post-2" }, { postId: "post-3" }]);
		const { listPinnedPostIds } = await import("./queries");

		const result = await listPinnedPostIds();

		expect(result).toEqual(["post-1", "post-2", "post-3"]);
	});
});

describe("pinPost limit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws when 3 posts are already pinned", async () => {
		mockCountSelect(3);
		const { pinPost } = await import("./queries");

		await expect(pinPost("post-4")).rejects.toThrow("limit");
	});
});
