import { buildVapidAuthHeader, encryptPayload } from "./web-push";

describe("buildVapidAuthHeader", () => {
	it("returns a valid Authorization header with vapid scheme", async () => {
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
