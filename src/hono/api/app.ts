import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const appEndpoint = createHono();

appEndpoint.use("*", authMiddleware());

appEndpoint.get("/me", (c) => {
	const user = c.get("user");
	return c.json({ data: user });
});

export default appEndpoint;
