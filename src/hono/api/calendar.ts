// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	createCalendarEvent,
	createCalendarEventSchema,
	deleteCalendarEvent,
	listCalendarEvents,
	updateCalendarEvent,
	updateCalendarEventSchema,
} from "@/db/calendar";
import { createHono } from "@/hono/factory";
import { adminMiddleware } from "@/hono/middleware/admin";
import { authMiddleware } from "@/hono/middleware/auth";

const calendarEndpoint = createHono();

calendarEndpoint.use("*", authMiddleware());
calendarEndpoint.use("*", adminMiddleware());

calendarEndpoint.get("/", async (c) => {
	const data = await listCalendarEvents();
	return c.json({ data });
});

calendarEndpoint.post("/", async (c) => {
	const body = await c.req.json();
	const parsed = createCalendarEventSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, 400);
	}

	const data = await createCalendarEvent(parsed.data);
	return c.json({ data }, 201);
});

calendarEndpoint.patch("/:id", async (c) => {
	const body = await c.req.json();
	const parsed = updateCalendarEventSchema.safeParse(body);

	if (!parsed.success) {
		return c.json({ error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }, 400);
	}

	const updated = await updateCalendarEvent(c.req.param("id"), parsed.data);
	if (!updated) {
		return c.json({ error: "Nie znaleziono wydarzenia" }, 404);
	}
	return c.json({ data: updated });
});

calendarEndpoint.delete("/:id", async (c) => {
	const deleted = await deleteCalendarEvent(c.req.param("id"));
	if (!deleted) {
		return c.json({ error: "Nie znaleziono wydarzenia" }, 404);
	}
	return c.json({ data: { id: deleted.id, deleted: true } });
});

export default calendarEndpoint;
