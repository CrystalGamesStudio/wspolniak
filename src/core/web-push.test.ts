// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildVapidAuthHeader, encryptPayload, resolveVapidSubject } from "./web-push";

describe("buildVapidAuthHeader", () => {
	it("returns a valid Authorization header with vapid scheme (PKCS8 private key)", async () => {
		const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
			"sign",
		]);

		const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
		const rawPrivate = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

		const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawPublic)));
		const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawPrivate)));

		const header = await buildVapidAuthHeader({
			audience: "https://push.example.com",
			subject: "mailto:admin@example.com",
			publicKey: publicKeyBase64,
			privateKey: privateKeyBase64,
		});

		expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
	});

	it("accepts raw 32-byte private key (format emitted by `web-push generate-vapid-keys`)", async () => {
		const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
			"sign",
			"verify",
		]);

		const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
		const jwkPrivate = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
		if (!jwkPrivate.d) throw new Error("expected JWK to expose d");

		// Decode URL-safe base64 of JWK.d to get the raw 32-byte scalar, then
		// re-encode as standard base64 (the format the .production.vars-style
		// keys are typically pasted in).
		const padded = jwkPrivate.d + "=".repeat((4 - (jwkPrivate.d.length % 4)) % 4);
		const rawScalarBinary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
		const rawScalarBytes = new Uint8Array(rawScalarBinary.length);
		for (let i = 0; i < rawScalarBinary.length; i++) {
			rawScalarBytes[i] = rawScalarBinary.charCodeAt(i);
		}
		expect(rawScalarBytes.length).toBe(32);

		const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawPublic)));
		const privateKeyBase64 = btoa(String.fromCharCode(...rawScalarBytes));

		const header = await buildVapidAuthHeader({
			audience: "https://push.example.com",
			subject: "mailto:admin@example.com",
			publicKey: publicKeyBase64,
			privateKey: privateKeyBase64,
		});

		expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
	});
});

describe("resolveVapidSubject", () => {
	it("returns env value as-is when it already contains the mailto: scheme", () => {
		expect(resolveVapidSubject("mailto:admin@wspolniak.com")).toBe("mailto:admin@wspolniak.com");
	});

	it("returns env value as-is when it is an https: URI", () => {
		expect(resolveVapidSubject("https://wspolniak.com/contact")).toBe(
			"https://wspolniak.com/contact",
		);
	});

	it("prefixes a bare email with mailto:", () => {
		expect(resolveVapidSubject("admin@wspolniak.com")).toBe("mailto:admin@wspolniak.com");
	});

	it("falls back to a default mailto subject when env is undefined", () => {
		const result = resolveVapidSubject(undefined);
		expect(result).toMatch(/^mailto:/);
	});
});

describe("encryptPayload", () => {
	it("returns encrypted content, salt, and server public key", async () => {
		const clientKeyPair = await crypto.subtle.generateKey(
			{ name: "ECDH", namedCurve: "P-256" },
			true,
			["deriveBits"],
		);
		const rawClientPublic = await crypto.subtle.exportKey("raw", clientKeyPair.publicKey);
		const p256dh = btoa(String.fromCharCode(...new Uint8Array(rawClientPublic)));

		const authBytes = crypto.getRandomValues(new Uint8Array(16));
		const auth = btoa(String.fromCharCode(...authBytes));

		const result = await encryptPayload(
			JSON.stringify({ title: "Test", body: "Hello" }),
			p256dh,
			auth,
		);

		expect(result.ciphertext).toBeInstanceOf(Uint8Array);
		expect(result.ciphertext.length).toBeGreaterThan(0);
		expect(result.salt).toBeInstanceOf(Uint8Array);
		expect(result.salt.length).toBe(16);
		expect(result.serverPublicKey).toBeInstanceOf(Uint8Array);
		expect(result.serverPublicKey.length).toBe(65);
	});
});
