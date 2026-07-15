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
import { composeOnDayText, composeWeekBeforeText } from "./job";

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

/** Rozróżnia odpowiedzi findEventsByDayMonth po kluczu "day-month" — orkiestrator
 * pyta osobno o "dziś" i o "dziś + 7", więc mock musi reagować na argumenty. */
function eventsByDayMonth(map: Record<string, CalendarEvent[]>): void {
	mockFindEvents.mockImplementation((day: number, month: number) =>
		Promise.resolve(map[`${day}-${month}`] ?? []),
	);
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

describe("composeWeekBeforeText", () => {
	it("composes 'Za tydzień: {title}' when the event has no description", () => {
		expect(composeWeekBeforeText({ title: "Urodziny", description: null })).toBe(
			"Za tydzień: Urodziny",
		);
	});

	it("appends the description under the header when present", () => {
		expect(composeWeekBeforeText({ title: "Urodziny", description: "Kto ma imieniny" })).toBe(
			"Za tydzień: Urodziny\n\nKto ma imieniny",
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
		eventsByDayMonth({ "14-7": [e1, e2] });
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
		eventsByDayMonth({ "14-7": [e1, e2] });
		mockClaimReminder.mockResolvedValue(claimed());
		mockCreatePost.mockRejectedValueOnce(new Error("boom"));
		const { runCalendarJob } = await import("./job");

		await expect(runCalendarJob(now)).resolves.toBeUndefined();

		expect(mockCreatePost).toHaveBeenCalledTimes(2); // second event still processed
	});

	it("creates a 'Za tydzień' post for an event 7 days ahead (week_before basket)", async () => {
		mockGetActiveAdmin.mockResolvedValue(admin());
		eventsByDayMonth({
			"14-7": [], // nic dzisiaj
			"21-7": [event({ id: "evt-week", title: "Wycieczka", day: 21, month: 7 })],
		});
		mockClaimReminder.mockResolvedValue(
			claimed({ id: "rem-week", eventId: "evt-week", type: "week_before" }),
		);
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockFindEvents).toHaveBeenCalledWith(21, 7);
		expect(mockClaimReminder).toHaveBeenCalledWith("evt-week", "week_before", expect.any(Date));
		expect(mockCreatePost).toHaveBeenCalledWith({
			authorId: "admin-1",
			description: "Za tydzień: Wycieczka",
		});
	});

	it("does not create a duplicate week_before post when already claimed today", async () => {
		mockGetActiveAdmin.mockResolvedValue(admin());
		eventsByDayMonth({
			"14-7": [],
			"21-7": [event({ id: "evt-week", title: "Wycieczka", day: 21, month: 7 })],
		});
		mockClaimReminder.mockResolvedValue(null); // już zgłoszone wcześniej tego dnia
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockClaimReminder).toHaveBeenCalledWith("evt-week", "week_before", expect.any(Date));
		expect(mockCreatePost).not.toHaveBeenCalled();
	});

	it("fires the week_before basket across a year boundary (28.12 → event 4.01)", async () => {
		// Realny addDaysPoland: 28.12.2025 + 7 dni = 4.01.2026 (przełom roku).
		const nye = new Date("2025-12-28T04:00:00Z"); // 05:00 PL → 28.12.2025
		mockGetActiveAdmin.mockResolvedValue(admin());
		eventsByDayMonth({
			"28-12": [],
			"4-1": [event({ id: "evt-nye", title: "Sylwester", day: 4, month: 1 })],
		});
		mockClaimReminder.mockResolvedValue(
			claimed({ id: "rem-nye", eventId: "evt-nye", type: "week_before" }),
		);
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(nye);

		expect(mockFindEvents).toHaveBeenCalledWith(4, 1);
		expect(mockClaimReminder).toHaveBeenCalledWith("evt-nye", "week_before", expect.any(Date));
		expect(mockCreatePost).toHaveBeenCalledWith({
			authorId: "admin-1",
			description: "Za tydzień: Sylwester",
		});
	});

	it("does not create a 'Dzisiaj' post after the event was deleted (story 6)", async () => {
		// Scenariusz: "tydzień przed" wyszedł poprzednio, admin usuwa wydarzenie.
		// Dziś findEventsByDayMonth nie zwraca już tego wydarzenia (a jego reminder_log
		// skasowano kaskadowo — patrz queries.test.ts), więc post "Dzisiaj" nie powstaje.
		mockGetActiveAdmin.mockResolvedValue(admin());
		eventsByDayMonth({ "14-7": [], "21-7": [] });
		const { runCalendarJob } = await import("./job");

		await runCalendarJob(now);

		expect(mockClaimReminder).not.toHaveBeenCalled();
		expect(mockCreatePost).not.toHaveBeenCalled();
	});
});
