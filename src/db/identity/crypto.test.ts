import { generateToken } from "./crypto";

describe("generateToken", () => {
	it("returns plaintext as base64url string (no padding)", async () => {
		const { plaintext } = await generateToken();
		expect(plaintext).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(plaintext.length).toBeGreaterThan(0);
	});

	it("returns hash that is SHA-256 hex of the plaintext", async () => {
		const { plaintext, hash } = await generateToken();

		const encoder = new TextEncoder();
		const data = encoder.encode(plaintext);
		const digest = await crypto.subtle.digest("SHA-256", data);
		const expectedHash = Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		expect(hash).toBe(expectedHash);
	});

	it("generates unique tokens on each call", async () => {
		const a = await generateToken();
		const b = await generateToken();
		expect(a.plaintext).not.toBe(b.plaintext);
		expect(a.hash).not.toBe(b.hash);
	});
});
