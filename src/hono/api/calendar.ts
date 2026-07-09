// SPDX-License-Identifier: AGPL-3.0-or-later
import { createCalendarEvent, createCalendarEventSchema, listCalendarEvents } from "@/db/calendar";
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

export default calendarEndpoint;
