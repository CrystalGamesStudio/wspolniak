// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTableName } from "drizzle-orm";
import { calendarEvents, calendarReminderLog } from "./table";

describe("calendar tables", () => {
	it("names calendar_events", () => {
		expect(getTableName(calendarEvents)).toBe("calendar_events");
	});

	it("names calendar_reminder_log", () => {
		expect(getTableName(calendarReminderLog)).toBe("calendar_reminder_log");
	});
});
