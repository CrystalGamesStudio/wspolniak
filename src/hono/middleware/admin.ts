import { createMiddleware } from "hono/factory";
import type { SessionPayload } from "@/db/identity/session";

export function adminMiddleware() {
	return createMiddleware<{
		Variables: { user: SessionPayload };
	}>(async (c, next) => {
		const user = c.get("user");

		if (user.role !== "admin") {
			return c.json({ error: "Forbidden" }, 403);
		}

		await next();
	});
}
