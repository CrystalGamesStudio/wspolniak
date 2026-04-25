// SPDX-License-Identifier: AGPL-3.0-or-later
vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
}));

vi.mock("@/db/push-subscriptions/queries", () => ({
	saveSubscription: vi.fn(),
	deleteSubscriptionByEndpoint: vi.fn(),
}));

vi.mock("@/db/setup/queries", () => ({
	isInstanceSetUp: vi.fn(),
}));

import { apiHono } from "./api";

const env = {
	SESSION_SECRET: "test-secret",
	VAPID_PUBLIC_KEY: "test-vapid-public-key",
	CLOUDFLARE_ENV: "test",
};

describe("API router — route ordering", () => {
	it("GET /api/app/push/vapid-key returns VAPID key without auth", async () => {
		const res = await apiHono.request("/api/app/push/vapid-key", {}, env);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { publicKey: string } };
		expect(body.data.publicKey).toBe("test-vapid-public-key");
	});

	it("GET /api/app/push/vapid-key returns 503 when VAPID_PUBLIC_KEY is missing", async () => {
		const envWithoutVapid = {
			SESSION_SECRET: "test-secret",
			CLOUDFLARE_ENV: "test",
		};
		const res = await apiHono.request("/api/app/push/vapid-key", {}, envWithoutVapid);

		expect(res.status).toBe(503);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Push not configured");
	});

	it("POST /api/app/push/subscribe without session cookie returns 401", async () => {
		const res = await apiHono.request(
			"/api/app/push/subscribe",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endpoint: "https://push.example/abc",
					keys: { p256dh: "p", auth: "a" },
				}),
			},
			env,
		);

		expect(res.status).toBe(401);
	});

	it("DELETE /api/app/push/subscribe without session cookie returns 401", async () => {
		const res = await apiHono.request(
			"/api/app/push/subscribe",
			{
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ endpoint: "https://push.example/abc" }),
			},
			env,
		);

		expect(res.status).toBe(401);
	});

	it("GET /api/app/me without session cookie returns 401 (regression: route reorder must not bypass auth)", async () => {
		const res = await apiHono.request("/api/app/me", {}, env);

		expect(res.status).toBe(401);
	});
});
