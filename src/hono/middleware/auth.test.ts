// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

import type { SessionPayload } from "@/db/identity/session";
import { verifySessionCookie } from "@/db/identity/session";
import { authMiddleware } from "./auth";

const mockVerify = vi.mocked(verifySessionCookie);

function createTestApp() {
	const app = new Hono<{
		Bindings: { SESSION_SECRET: string };
		Variables: { user: SessionPayload };
	}>();
	app.use("*", authMiddleware());
	app.get("/test", (c) => {
		const user = c.get("user");
		return c.json({ user });
	});
	return app;
}

describe("authMiddleware", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sets user in context for valid session cookie", async () => {
		const payload: SessionPayload = { userId: "u1", name: "Tomek", role: "admin" };
		mockVerify.mockResolvedValue(payload);

		const app = createTestApp();
		const res = await app.request(
			"/test",
			{
				headers: { Cookie: "session=valid-jwt-token" },
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: SessionPayload };
		expect(body.user).toEqual(payload);
		expect(mockVerify).toHaveBeenCalledWith("valid-jwt-token", "secret");
	});

	it("returns 401 when no cookie is present", async () => {
		const app = createTestApp();
		const res = await app.request("/test", {}, { SESSION_SECRET: "secret" });

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Unauthorized");
		expect(mockVerify).not.toHaveBeenCalled();
	});

	it("returns 401 when cookie is invalid or expired", async () => {
		mockVerify.mockResolvedValue(null);

		const app = createTestApp();
		const res = await app.request(
			"/test",
			{
				headers: { Cookie: "session=expired-or-tampered" },
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Unauthorized");
		expect(mockVerify).toHaveBeenCalledWith("expired-or-tampered", "secret");
	});
});
