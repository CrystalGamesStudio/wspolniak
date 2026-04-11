import { createSessionCookie, SESSION_COOKIE_NAME, verifySessionCookie } from "./session";

const SECRET = "test-secret-at-least-32-characters-long";

const testUser = {
	id: "user-1",
	name: "Tomek",
	role: "admin",
};

describe("session cookie", () => {
	describe("round-trip", () => {
		it("verifySessionCookie returns same payload that was signed", async () => {
			const cookie = await createSessionCookie(testUser, SECRET);
			const payload = await verifySessionCookie(cookie, SECRET);

			expect(payload).toEqual({
				userId: "user-1",
				name: "Tomek",
				role: "admin",
			});
		});
	});

	describe("rejection", () => {
		it("returns null for tampered cookie", async () => {
			const cookie = await createSessionCookie(testUser, SECRET);
			const tampered = `${cookie}x`;
			const payload = await verifySessionCookie(tampered, SECRET);

			expect(payload).toBeNull();
		});

		it("returns null for wrong secret", async () => {
			const cookie = await createSessionCookie(testUser, SECRET);
			const payload = await verifySessionCookie(cookie, "wrong-secret-that-is-long-enough");

			expect(payload).toBeNull();
		});

		it("returns null for expired cookie", async () => {
			vi.useFakeTimers();
			const cookie = await createSessionCookie(testUser, SECRET);

			// Advance time past 1 year expiry
			vi.advanceTimersByTime(366 * 24 * 60 * 60 * 1000);
			const payload = await verifySessionCookie(cookie, SECRET);

			expect(payload).toBeNull();
			vi.useRealTimers();
		});

		it("returns null for malformed token", async () => {
			expect(await verifySessionCookie("not-a-jwt", SECRET)).toBeNull();
			expect(await verifySessionCookie("", SECRET)).toBeNull();
		});
	});

	describe("SESSION_COOKIE_NAME", () => {
		it("is 'session'", () => {
			expect(SESSION_COOKIE_NAME).toBe("session");
		});
	});
});
