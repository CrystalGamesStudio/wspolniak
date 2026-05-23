// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
}));

import { findActiveUserById } from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import appEndpoint from "./app";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);

function createApi() {
	const api = new Hono<{ Bindings: { SESSION_SECRET: string } }>().basePath("/api");
	api.route("/app", appEndpoint);
	return api;
}

describe("GET /api/app/me", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns user data with valid session", async () => {
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "admin" });
		mockFindUser.mockResolvedValue({
			id: "u1",
			name: "Tomek",
			role: "admin",
			tokenHash: "hash",
			deletedAt: null,
			createdAt: new Date(),
		});

		const api = createApi();
		const res = await api.request(
			"/api/app/me",
			{
				headers: { Cookie: "session=valid-jwt" },
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { userId: string; name: string; role: string } };
		expect(body.data).toEqual({ userId: "u1", name: "Tomek", role: "admin" });
	});

	it("returns 401 without session cookie", async () => {
		const api = createApi();
		const res = await api.request("/api/app/me", {}, { SESSION_SECRET: "secret" });

		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Unauthorized");
	});
});
