// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import type { CreateCalendarEventRequest } from "./schema";
import { calendarEvents } from "./table";

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
