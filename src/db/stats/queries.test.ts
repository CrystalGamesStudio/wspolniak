// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	getDailyActiveUsers,
	getLeaderboard,
	getPhotosLast7Days,
	getPushDeliveryRateLast7Days,
	getStatsSummary,
	getTotalCounts,
} from "./queries";

vi.mock("@/db/setup", () => ({ getDb: vi.fn() }));
vi.mock("@/db/push-delivery-events/queries", () => ({
	countDeliveriesInWindow: vi.fn(),
}));

import { countDeliveriesInWindow } from "@/db/push-delivery-events/queries";
import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);
const mockCountDeliveries = vi.mocked(countDeliveriesInWindow);

const NOW = new Date("2026-07-07T12:00:00.000Z");

function mockExecute(c: number) {
	mockGetDb.mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [{ c }] }) } as never);
}

function mockSelectCount(n: number) {
	const where = vi.fn().mockResolvedValue([{ count: n }]);
	const from = vi.fn().mockReturnValue({ where });
	const select = vi.fn().mockReturnValue({ from });
	mockGetDb.mockReturnValue({ select } as never);
}

describe("getDailyActiveUsers", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns the distinct active authors count", async () => {
		mockExecute(3);
		expect(await getDailyActiveUsers(NOW)).toBe(3);
	});

	it("returns 0 when no active authors", async () => {
		mockExecute(0);
		expect(await getDailyActiveUsers(NOW)).toBe(0);
	});
});

describe("getPhotosLast7Days", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns the photo count in the window", async () => {
		mockSelectCount(42);
		expect(await getPhotosLast7Days(NOW)).toBe(42);
	});

	it("returns 0 when no photos", async () => {
		mockSelectCount(0);
		expect(await getPhotosLast7Days(NOW)).toBe(0);
	});
});

describe("getPushDeliveryRateLast7Days", () => {
	beforeEach(() => vi.clearAllMocks());

	it("computes rate = successes/attempts rounded to 4 places", async () => {
		mockCountDeliveries.mockResolvedValue({ attempts: 10, successes: 8 });
		expect(await getPushDeliveryRateLast7Days(NOW)).toEqual({
			attempts: 10,
			successes: 8,
			rate: 0.8,
		});
	});

	it("returns rate 0 (not NaN) when there are no attempts", async () => {
		mockCountDeliveries.mockResolvedValue({ attempts: 0, successes: 0 });
		expect(await getPushDeliveryRateLast7Days(NOW)).toEqual({
			attempts: 0,
			successes: 0,
			rate: 0,
		});
	});

	it("rounds long decimals to 4 places", async () => {
		mockCountDeliveries.mockResolvedValue({ attempts: 3, successes: 1 });
		const result = await getPushDeliveryRateLast7Days(NOW);
		expect(result.rate).toBe(0.3333);
	});
});

describe("getTotalCounts", () => {
	beforeEach(() => vi.clearAllMocks());

	it("counts all five tables in one query", async () => {
		mockGetDb.mockReturnValue({
			execute: vi.fn().mockResolvedValue({
				rows: [{ posts: 150, comments: 800, photos: 320, reactions: 1240, mentions: 95 }],
			}),
		} as never);
		expect(await getTotalCounts()).toEqual({
			posts: 150,
			comments: 800,
			photos: 320,
			reactions: 1240,
			mentions: 95,
		});
	});

	it("returns zeros when no row comes back", async () => {
		mockGetDb.mockReturnValue({
			execute: vi.fn().mockResolvedValue({ rows: [] }),
		} as never);
		expect(await getTotalCounts()).toEqual({
			posts: 0,
			comments: 0,
			photos: 0,
			reactions: 0,
			mentions: 0,
		});
	});
});

describe("getStatsSummary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("composes all metrics with ISO windowStart/windowEnd spanning exactly 7 days", async () => {
		// execute obsługuje jednocześnie getActiveUserCount (czyta `c`) i getTotalCounts
		// (czyta posts/comments/photos/reactions/mentions) — jeden row ze wszystkimi polami.
		const execute = vi.fn().mockResolvedValue({
			rows: [{ c: 2, posts: 150, comments: 800, photos: 320, reactions: 1240, mentions: 95 }],
		});
		const where = vi.fn().mockResolvedValue([{ count: 7 }]);
		const from = vi.fn().mockReturnValue({ where });
		const select = vi.fn().mockReturnValue({ from });
		mockGetDb.mockReturnValue({ execute, select } as never);
		mockCountDeliveries.mockResolvedValue({ attempts: 5, successes: 4 });

		const summary = await getStatsSummary(NOW);

		expect(summary.dau).toBe(2);
		expect(summary.wau).toBe(2);
		expect(summary.photosLast7Days).toBe(7);
		expect(summary.pushDeliveryLast7Days).toEqual({ attempts: 5, successes: 4, rate: 0.8 });
		expect(summary.totalPosts).toBe(150);
		expect(summary.totalComments).toBe(800);
		expect(summary.totalPhotos).toBe(320);
		expect(summary.totalReactions).toBe(1240);
		expect(summary.totalMentions).toBe(95);
		expect(summary.windowEnd).toBe("2026-07-07T12:00:00.000Z");
		expect(summary.windowStart).toBe("2026-06-30T12:00:00.000Z");
	});
});

function mockExecuteRows(rows: Array<{ name: string; count: number }>) {
	mockGetDb.mockReturnValue({
		execute: vi.fn().mockResolvedValue({ rows }),
	} as never);
}

describe("getLeaderboard", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns leaderboard entries with member name and count", async () => {
		mockExecuteRows([
			{ name: "Ania", count: 5 },
			{ name: "Tomek", count: 3 },
		]);
		expect(await getLeaderboard("posts", 10)).toEqual([
			{ name: "Ania", count: 5 },
			{ name: "Tomek", count: 3 },
		]);
	});

	it("sorts entries by count descending", async () => {
		mockExecuteRows([
			{ name: "Tomek", count: 3 },
			{ name: "Ania", count: 5 },
			{ name: "Ewa", count: 4 },
		]);
		const result = await getLeaderboard("posts", 10);
		expect(result.map((e) => e.name)).toEqual(["Ania", "Ewa", "Tomek"]);
	});

	it("limits to the top N entries", async () => {
		mockExecuteRows([
			{ name: "A", count: 1 },
			{ name: "B", count: 2 },
			{ name: "C", count: 3 },
			{ name: "D", count: 4 },
			{ name: "E", count: 5 },
		]);
		const result = await getLeaderboard("posts", 3);
		expect(result).toHaveLength(3);
		expect(result.map((e) => e.name)).toEqual(["E", "D", "C"]);
	});

	it("breaks count ties by name ascending for a stable order", async () => {
		mockExecuteRows([
			{ name: "Zosia", count: 5 },
			{ name: "Adam", count: 5 },
			{ name: "Marysia", count: 5 },
		]);
		const result = await getLeaderboard("posts", 10);
		expect(result.map((e) => e.name)).toEqual(["Adam", "Marysia", "Zosia"]);
	});

	it.each([
		"posts",
		"comments",
		"photos",
		"reactions",
		"mentions-received",
		"mentions-made",
	] as const)("routes the %s category to its own query", async (category) => {
		mockExecuteRows([{ name: "X", count: 1 }]);
		expect(await getLeaderboard(category, 3)).toEqual([{ name: "X", count: 1 }]);
	});
});
