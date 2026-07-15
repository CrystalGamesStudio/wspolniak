// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import type { calendarEvents, calendarReminderLog } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

type EventRow = InferSelectModel<typeof calendarEvents>;
type ReminderLogRow = InferSelectModel<typeof calendarReminderLog>;
const now = new Date();

function mockEvent(overrides: Partial<EventRow> = {}): EventRow {
	return {
		id: "evt-1",
		title: "Urodziny",
		description: null,
		day: 15,
		month: 3,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function mockReminderLog(overrides: Partial<ReminderLogRow> = {}): ReminderLogRow {
	return {
		id: "rem-1",
		eventId: "evt-1",
		type: "on_day",
		firedFor: now,
		createdAt: now,
		...overrides,
	};
}

function mockInsertChain(returningRows: EventRow[]) {
	const mockReturning = vi.fn().mockResolvedValue(returningRows);
	const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
	mockGetDb.mockReturnValue({ insert: mockInsert } as never);
	return { mockInsert, mockValues };
}

function mockInsertOnConflictChain(returningRows: ReminderLogRow[]) {
	const mockReturning = vi.fn().mockResolvedValue(returningRows);
	const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflict });
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
	mockGetDb.mockReturnValue({ insert: mockInsert } as never);
	return { mockInsert, mockValues, mockOnConflict };
}

function mockSelectChain(rows: unknown[]) {
	// Both paths share `.from()` then terminate: listCalendarEvents via
	// `.orderBy()`, findEventsByDayMonth via `.where()`. Each is a thenable.
	const mockOrderBy = vi.fn().mockResolvedValue(rows);
	const mockWhere = vi.fn().mockResolvedValue(rows);
	const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy, where: mockWhere });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	mockGetDb.mockReturnValue({ select: mockSelect } as never);
	return { mockSelect, mockFrom, mockWhere };
}

function mockUpdateChain(returningRows: EventRow[]) {
	const mockReturning = vi.fn().mockResolvedValue(returningRows);
	const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
	const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
	mockGetDb.mockReturnValue({ update: mockUpdate } as never);
	return { mockUpdate, mockSet, mockWhere };
}

function mockDeleteChain(returningRows: EventRow[]) {
	// deleteCalendarEvent runs two deletes: reminder_log first (no .returning()),
	// then the event (with .returning()). Both terminate as thenables.
	const reminderLogWhere = vi.fn().mockResolvedValue(undefined);
	const eventReturning = vi.fn().mockResolvedValue(returningRows);
	const eventWhere = vi.fn().mockReturnValue({ returning: eventReturning });
	const mockDelete = vi.fn((_table: unknown) => {
		// Distinguish the two tables by the same table object identity the query passes.
		// The query calls delete(calendarReminderLog) then delete(calendarEvents).
		// We route by call order: first call → reminder_log, second → event.
		const calls = mockDelete.mock.calls.length;
		if (calls === 1) return { where: reminderLogWhere };
		return { where: eventWhere };
	});
	mockGetDb.mockReturnValue({ delete: mockDelete } as never);
	return { mockDelete, reminderLogWhere, eventWhere };
}

describe("createCalendarEvent", () => {
	beforeEach(() => vi.clearAllMocks());

	it("inserts an event and returns the created row", async () => {
		const { mockValues } = mockInsertChain([mockEvent()]);
		const { createCalendarEvent } = await import("./queries");

		const result = await createCalendarEvent({
			title: "Urodziny",
			description: null,
			day: 15,
			month: 3,
		});

		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				id: expect.any(String),
				title: "Urodziny",
				day: 15,
				month: 3,
			}),
		);
		expect(result.id).toBe("evt-1");
	});

	it("throws when insert returns no rows", async () => {
		mockInsertChain([]);
		const { createCalendarEvent } = await import("./queries");

		await expect(
			createCalendarEvent({ title: "X", description: null, day: 1, month: 1 }),
		).rejects.toThrow();
	});
});

describe("listCalendarEvents", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns events ordered by month then day", async () => {
		mockSelectChain([mockEvent({ id: "a" }), mockEvent({ id: "b" })]);
		const { listCalendarEvents } = await import("./queries");

		const result = await listCalendarEvents();

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("a");
	});
});

describe("findEventsByDayMonth", () => {
	beforeEach(() => vi.clearAllMocks());

	it("queries events matching given day and month", async () => {
		const { mockWhere } = mockSelectChain([mockEvent({ id: "a", day: 15, month: 3 })]);
		const { findEventsByDayMonth } = await import("./queries");

		const result = await findEventsByDayMonth(15, 3);

		expect(result).toHaveLength(1);
		expect(result[0].day).toBe(15);
		expect(result[0].month).toBe(3);
		expect(mockWhere).toHaveBeenCalled();
	});

	it("returns empty array when no events match", async () => {
		mockSelectChain([]);
		const { findEventsByDayMonth } = await import("./queries");

		const result = await findEventsByDayMonth(29, 2);

		expect(result).toEqual([]);
	});
});

describe("updateCalendarEvent", () => {
	beforeEach(() => vi.clearAllMocks());

	it("updates the fields and returns the updated row", async () => {
		const { mockSet } = mockUpdateChain([mockEvent({ id: "evt-1", title: "Nowy" })]);
		const { updateCalendarEvent } = await import("./queries");

		const result = await updateCalendarEvent("evt-1", { title: "Nowy" });

		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Nowy", updatedAt: expect.any(Date) }),
		);
		expect(result?.id).toBe("evt-1");
		expect(result?.title).toBe("Nowy");
	});

	it("returns null when no event matches the id", async () => {
		mockUpdateChain([]);
		const { updateCalendarEvent } = await import("./queries");

		const result = await updateCalendarEvent("missing", { title: "X" });

		expect(result).toBeNull();
	});
});

describe("deleteCalendarEvent", () => {
	beforeEach(() => vi.clearAllMocks());

	it("deletes the reminder_log rows and the event (cascade)", async () => {
		const { mockDelete } = mockDeleteChain([mockEvent({ id: "evt-1" })]);
		const { deleteCalendarEvent } = await import("./queries");

		const result = await deleteCalendarEvent("evt-1");

		expect(mockDelete).toHaveBeenCalledTimes(2);
		expect(result?.id).toBe("evt-1");
	});

	it("returns null when no event matches the id", async () => {
		mockDeleteChain([]);
		const { deleteCalendarEvent } = await import("./queries");

		const result = await deleteCalendarEvent("missing");

		expect(result).toBeNull();
	});
});

describe("claimReminder", () => {
	beforeEach(() => vi.clearAllMocks());

	it("claims the reminder and returns the row on first insert", async () => {
		const firedFor = new Date("2026-07-14T00:00:00Z");
		const { mockValues } = mockInsertOnConflictChain([mockReminderLog({ firedFor })]);
		const { claimReminder } = await import("./queries");

		const result = await claimReminder("evt-1", "on_day", firedFor);

		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: "evt-1",
				type: "on_day",
				firedFor,
				id: expect.any(String),
			}),
		);
		expect(result).not.toBeNull();
		expect(result?.eventId).toBe("evt-1");
	});

	it("returns null when the reminder was already claimed today (conflict)", async () => {
		mockInsertOnConflictChain([]);
		const { claimReminder } = await import("./queries");

		const result = await claimReminder("evt-1", "on_day", new Date("2026-07-14T00:00:00Z"));

		expect(result).toBeNull();
	});

	it("claims a week_before reminder and returns the row on first insert", async () => {
		const firedFor = new Date("2026-07-14T00:00:00Z");
		const { mockValues } = mockInsertOnConflictChain([
			mockReminderLog({ type: "week_before", firedFor }),
		]);
		const { claimReminder } = await import("./queries");

		const result = await claimReminder("evt-1", "week_before", firedFor);

		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: "evt-1",
				type: "week_before",
				firedFor,
				id: expect.any(String),
			}),
		);
		expect(result?.type).toBe("week_before");
	});

	it("returns null when a week_before reminder was already claimed today (conflict)", async () => {
		mockInsertOnConflictChain([]);
		const { claimReminder } = await import("./queries");

		const result = await claimReminder("evt-1", "week_before", new Date("2026-07-14T00:00:00Z"));

		expect(result).toBeNull();
	});
});
