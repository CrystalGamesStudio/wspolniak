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
});
