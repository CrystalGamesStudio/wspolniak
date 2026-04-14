// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import {
	SESSION_COOKIE_NAME,
	type SessionPayload,
	verifySessionCookie,
} from "@/db/identity/session";

export function authMiddleware() {
	return createMiddleware<{
		Bindings: { SESSION_SECRET: string };
		Variables: { user: SessionPayload };
	}>(async (c, next) => {
		const token = getCookie(c, SESSION_COOKIE_NAME);

		if (!token) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const payload = await verifySessionCookie(token, c.env.SESSION_SECRET);

		if (!payload) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		c.set("user", payload);
		await next();
	});
}
