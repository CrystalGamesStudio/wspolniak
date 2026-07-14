// SPDX-License-Identifier: AGPL-3.0-or-later
// Granice systemu mockujemy: DB (identity, calendar, posts). Czystych helperów
// timezone NIE mockujemy — to prawdziwa logika dat, testowana osobno.
vi.mock("@/db/identity", () => ({
	getActiveAdmin: vi.fn(),
}));
vi.mock("@/db/calendar", () => ({
	findEventsByDayMonth: vi.fn(),
	claimReminder: vi.fn(),
}));
vi.mock("@/db/posts", () => ({
	createPost: vi.fn(),
}));

import type { CalendarEvent, CalendarReminderLog } from "@/db/calendar";
import { claimReminder, findEventsByDayMonth } from "@/db/calendar";
import type { User } from "@/db/identity";
import { getActiveAdmin } from "@/db/identity";
import { createPost } from "@/db/posts";
import { composeOnDayText } from "./job";

const mockGetActiveAdmin = vi.mocked(getActiveAdmin);
const mockFindEvents = vi.mocked(findEventsByDayMonth);
const mockClaimReminder = vi.mocked(claimReminder);
const mockCreatePost = vi.mocked(createPost);

const now = new Date("2026-07-14T04:00:00Z"); // 06:00 PL → dzień 14.07

function admin(overrides: Partial<User> = {}): User {
	return {
		id: "admin-1",
		name: "Tomek",
		role: "admin",
		tokenHash: "h",
		deletedAt: null,
		createdAt: now,
		...overrides,
	};
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: "evt-1",
		title: "Urodziny",
		description: null,
		day: 14,
		month: 7,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function claimed(overrides: Partial<CalendarReminderLog> = {}): CalendarReminderLog {
	return {
		id: "rem-1",
		eventId: "evt-1",
		type: "on_day",
		firedFor: now,
		createdAt: now,
		...overrides,
	};
}

describe("composeOnDayText", () => {
	it("composes 'Dzisiaj: {title}' when the event has no description", () => {
		expect(composeOnDayText({ title: "Urodziny", description: null })).toBe("Dzisiaj: Urodziny");
	});

	it("appends the description under the header when present", () => {
		expect(composeOnDayText({ title: "Urodziny", description: "Kto ma imieniny" })).toBe(
			"Dzisiaj: Urodziny\n\nKto ma imieniny",
		);
	});
});

describe("runCalendarJob", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates a post from the active admin for today's event (Dzisiaj: {title})", async () => {
		mockGetActiveAdmin.mockResolvedValue(admin());
		mockFindEvents.mockResolvedValue([event()]);
		mockClaimReminder.mockResolvedValue(claimed());
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockFindEvents).toHaveBeenCalledWith(14, 7);
		expect(mockCreatePost).toHaveBeenCalledWith({
			authorId: "admin-1",
			description: "Dzisiaj: Urodziny",
		});
	});

	it("skips silently (no post, no throw) when there is no active admin", async () => {
		mockGetActiveAdmin.mockResolvedValue(null);
		mockFindEvents.mockResolvedValue([event()]);
		const { runCalendarJob } = await import("./job");

		await expect(runCalendarJob(now)).resolves.toBeUndefined();

		expect(mockFindEvents).not.toHaveBeenCalled();
		expect(mockCreatePost).not.toHaveBeenCalled();
	});

	it("does not create a duplicate post when the reminder was already claimed today", async () => {
		mockGetActiveAdmin.mockResolvedValue(admin());
		mockFindEvents.mockResolvedValue([event()]);
		mockClaimReminder.mockResolvedValue(null); // already claimed earlier today
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockClaimReminder).toHaveBeenCalledWith("evt-1", "on_day", expect.any(Date));
		expect(mockCreatePost).not.toHaveBeenCalled();
	});

	it("creates a separate post for each of today's events (description appended when present)", async () => {
		const e1 = event({ id: "evt-1", title: "Urodziny", description: null });
		const e2 = event({ id: "evt-2", title: "Imieniny", description: "Kto świętuje" });
		mockGetActiveAdmin.mockResolvedValue(admin());
		mockFindEvents.mockResolvedValue([e1, e2]);
		mockClaimReminder.mockResolvedValue(claimed());
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockCreatePost).toHaveBeenCalledTimes(2);
		expect(mockCreatePost).toHaveBeenNthCalledWith(1, {
			authorId: "admin-1",
			description: "Dzisiaj: Urodziny",
		});
		expect(mockCreatePost).toHaveBeenNthCalledWith(2, {
			authorId: "admin-1",
			description: "Dzisiaj: Imieniny\n\nKto świętuje",
		});
	});

	it("isolates per-event errors: a failing event does not stop the others", async () => {
		const e1 = event({ id: "evt-1", title: "Urodziny" });
		const e2 = event({ id: "evt-2", title: "Imieniny" });
		mockGetActiveAdmin.mockResolvedValue(admin());
		mockFindEvents.mockResolvedValue([e1, e2]);
		mockClaimReminder.mockResolvedValue(claimed());
		mockCreatePost.mockRejectedValueOnce(new Error("boom"));
		const { runCalendarJob } = await import("./job");

		await expect(runCalendarJob(now)).resolves.toBeUndefined();

		expect(mockCreatePost).toHaveBeenCalledTimes(2); // second event still processed
	});
});
