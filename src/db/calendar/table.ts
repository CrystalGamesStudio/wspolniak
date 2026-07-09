// SPDX-License-Identifier: AGPL-3.0-or-later
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const calendarEvents = pgTable("calendar_events", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	day: integer("day").notNull(),
	month: integer("month").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const calendarReminderLog = pgTable(
	"calendar_reminder_log",
	{
		id: text("id").primaryKey(),
		eventId: text("event_id").notNull(),
		type: text("type").notNull(),
		firedFor: timestamp("fired_for").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		uniqueIndex("calendar_reminder_log_event_id_type_fired_for_idx").on(
			t.eventId,
			t.type,
			t.firedFor,
		),
	],
);
