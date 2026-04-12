import { Hono } from "hono";
import type { SessionPayload } from "@/db/identity/session";
import { adminMiddleware } from "./admin";

function createTestApp() {
	const app = new Hono<{
		Variables: { user: SessionPayload };
	}>();
	// Simulate auth middleware having already set the user
	app.use("*", async (c, next) => {
		const user = JSON.parse(c.req.header("x-test-user") ?? "null") as SessionPayload | null;
		if (user) c.set("user", user);
		await next();
	});
	app.use("*", adminMiddleware());
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("adminMiddleware", () => {
	it("returns 403 for non-admin members", async () => {
		const member: SessionPayload = { userId: "u2", name: "Kasia", role: "member" };
		const app = createTestApp();

		const res = await app.request("/test", {
			headers: { "x-test-user": JSON.stringify(member) },
		});

		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});

	it("allows admin users through", async () => {
		const admin: SessionPayload = { userId: "u1", name: "Tomek", role: "admin" };
		const app = createTestApp();

		const res = await app.request("/test", {
			headers: { "x-test-user": JSON.stringify(admin) },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});
});
