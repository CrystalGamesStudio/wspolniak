// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import type { CreateCalendarEventRequest, UpdateCalendarEventRequest } from "./schema";
import { calendarEvents, calendarReminderLog } from "./table";

export type CalendarEvent = InferSelectModel<typeof calendarEvents>;

export async function createCalendarEvent(
	input: CreateCalendarEventRequest,
): Promise<CalendarEvent> {
	const db = getDb();
	const rows = await db
		.insert(calendarEvents)
		.values({
			id: crypto.randomUUID(),
			title: input.title,
			description: input.description,
			day: input.day,
			month: input.month,
		})
		.returning();
	const row = rows[0];
	if (!row) throw new Error("createCalendarEvent: insert returned no rows");
	return row;
}

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarEvents)
		.orderBy(asc(calendarEvents.month), asc(calendarEvents.day));
}

export async function findEventsByDayMonth(day: number, month: number): Promise<CalendarEvent[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarEvents)
		.where(and(eq(calendarEvents.day, day), eq(calendarEvents.month, month)));
}

export async function updateCalendarEvent(
	id: string,
	patch: UpdateCalendarEventRequest,
): Promise<CalendarEvent | null> {
	const db = getDb();
	const rows = await db
		.update(calendarEvents)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(calendarEvents.id, id))
		.returning();
	return rows[0] ?? null;
}

export async function deleteCalendarEvent(id: string): Promise<CalendarEvent | null> {
	const db = getDb();
	// Explicit cascade: clear reminder_log rows before removing the event so future
	// reminders for a deleted event never fire (DB-level FK cascade is not enforced —
	// see plans/calendar-v1.md F2). Safe to run even when no log rows exist.
	await db.delete(calendarReminderLog).where(eq(calendarReminderLog.eventId, id));
	const rows = await db.delete(calendarEvents).where(eq(calendarEvents.id, id)).returning();
	return rows[0] ?? null;
}
