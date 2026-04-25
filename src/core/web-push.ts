// SPDX-License-Identifier: AGPL-3.0-or-later
/** Web Push VAPID + encryption using Web Crypto API (CF Workers compatible). */

function base64ToUint8Array(base64: string): Uint8Array {
	const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface VapidInput {
	audience: string;
	subject: string;
	publicKey: string;
	privateKey: string;
}

async function importVapidPrivateKey(
	privateKeyBase64: string,
	publicKeyBase64: string,
): Promise<CryptoKey> {
	const privateKeyBytes = base64ToUint8Array(privateKeyBase64);

	// Raw 32-byte ECDSA P-256 scalar — the format `web-push generate-vapid-keys`
	// emits. Web Crypto can't import raw private keys directly, so wrap into JWK
	// using the public key's X/Y coordinates (we have the public key on input).
	if (privateKeyBytes.length === 32) {
		const publicKeyBytes = base64ToUint8Array(publicKeyBase64);
		if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
			throw new Error("VAPID public key must be 65-byte uncompressed P-256 point");
		}
		return crypto.subtle.importKey(
			"jwk",
			{
				kty: "EC",
				crv: "P-256",
				x: uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33)),
				y: uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65)),
				d: uint8ArrayToBase64Url(privateKeyBytes),
				ext: false,
			},
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["sign"],
		);
	}

	// PKCS8 DER (e.g. exported via `crypto.subtle.exportKey("pkcs8", ...)`)
	return crypto.subtle.importKey(
		"pkcs8",
		privateKeyBytes.buffer as ArrayBuffer,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

export async function buildVapidAuthHeader(input: VapidInput): Promise<string> {
	const header = { typ: "JWT", alg: "ES256" };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		aud: input.audience,
		exp: now + 12 * 60 * 60,
		sub: input.subject,
	};

	const encodedHeader = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
	const encodedPayload = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
	const unsignedToken = `${encodedHeader}.${encodedPayload}`;

	const key = await importVapidPrivateKey(input.privateKey, input.publicKey);

	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		key,
		new TextEncoder().encode(unsignedToken),
	);

	const signatureBytes = new Uint8Array(signature);
	const encodedSignature = uint8ArrayToBase64Url(signatureBytes);

	const publicKeyBytes = base64ToUint8Array(input.publicKey);
	const k = uint8ArrayToBase64Url(publicKeyBytes);

	return `vapid t=${unsignedToken}.${encodedSignature}, k=${k}`;
}

export async function encryptPayload(
	plaintext: string,
	clientPublicKeyBase64: string,
	clientAuthBase64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
	const clientPublicKeyBytes = base64ToUint8Array(clientPublicKeyBase64);
	const clientAuth = base64ToUint8Array(clientAuthBase64);

	const serverKeyPair = await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	);

	const clientPublicKey = await crypto.subtle.importKey(
		"raw",
		clientPublicKeyBytes.buffer as ArrayBuffer,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);

	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: clientPublicKey },
		serverKeyPair.privateKey,
		256,
	);

	const serverPublicKeyRaw = new Uint8Array(
		await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
	);

	const salt = crypto.getRandomValues(new Uint8Array(16));

	const authInfo = concatBuffers(
		new TextEncoder().encode("WebPush: info\0"),
		clientPublicKeyBytes,
		serverPublicKeyRaw,
	);

	const ikm = await hkdf(clientAuth, new Uint8Array(sharedSecret), authInfo, 32);

	const contentEncryptionKeyInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
	const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

	const cek = await hkdf(salt, ikm, contentEncryptionKeyInfo, 16);
	const nonce = await hkdf(salt, ikm, nonceInfo, 12);

	const paddedPlaintext = concatBuffers(new TextEncoder().encode(plaintext), new Uint8Array([2]));

	const encryptionKey = await crypto.subtle.importKey(
		"raw",
		cek.buffer as ArrayBuffer,
		"AES-GCM",
		false,
		["encrypt"],
	);

	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
		encryptionKey,
		paddedPlaintext.buffer as ArrayBuffer,
	);

	const recordSize = new ArrayBuffer(4);
	new DataView(recordSize).setUint32(0, 4096);

	const header = concatBuffers(
		salt,
		new Uint8Array(recordSize),
		new Uint8Array([serverPublicKeyRaw.length]),
		serverPublicKeyRaw,
	);

	const ciphertext = concatBuffers(header, new Uint8Array(encrypted));

	return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
	let totalLength = 0;
	for (const buf of buffers) {
		totalLength += buf.length;
	}
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const buf of buffers) {
		result.set(buf, offset);
		offset += buf.length;
	}
	return result;
}

async function hkdf(
	salt: Uint8Array,
	ikm: Uint8Array,
	info: Uint8Array,
	length: number,
): Promise<Uint8Array> {
	const prk = new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			await crypto.subtle.importKey(
				"raw",
				salt.buffer as ArrayBuffer,
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			),
			ikm.buffer as ArrayBuffer,
		),
	);

	const prkKey = await crypto.subtle.importKey(
		"raw",
		prk.buffer as ArrayBuffer,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const infoWithCounter = concatBuffers(info, new Uint8Array([1]));
	const okm = new Uint8Array(
		await crypto.subtle.sign("HMAC", prkKey, infoWithCounter.buffer as ArrayBuffer),
	);

	return okm.slice(0, length);
}

interface VapidKeys {
	publicKey: string;
	privateKey: string;
	subject: string;
}

/**
 * Normalizes a VAPID subject from env into a full URI per RFC 8292 §2.1.
 * Pass-through for values already containing a scheme; prefixes `mailto:`
 * onto bare emails. Apple Push rejects double-prefixed subjects with
 * `BadJwtToken`, so the env convention must be enforced at one place.
 */
export function resolveVapidSubject(envSubject: string | undefined): string {
	const value = envSubject?.trim();
	if (!value) return "mailto:admin@wspolniak.app";
	if (value.startsWith("mailto:") || value.startsWith("https:")) return value;
	return `mailto:${value}`;
}

interface VapidEnv {
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
}

/**
 * Builds a sendPush function from env vars, or returns null if VAPID is not
 * configured. Centralizes the subject-prefix logic so call sites can't reintroduce
 * the `mailto:mailto:...` bug.
 */
export function createSendWebPushFromEnv(
	env: VapidEnv,
): ReturnType<typeof createSendWebPush> | null {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
	return createSendWebPush({
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: resolveVapidSubject(env.VAPID_SUBJECT),
	});
}

export function createSendWebPush(vapidKeys: VapidKeys) {
	return async (
		subscription: { endpoint: string; p256dh: string; auth: string },
		payload: { title: string; body: string; icon: string; url: string },
	): Promise<Response> => {
		const audience = new URL(subscription.endpoint).origin;
		const authorization = await buildVapidAuthHeader({
			audience,
			subject: vapidKeys.subject,
			publicKey: vapidKeys.publicKey,
			privateKey: vapidKeys.privateKey,
		});

		const encrypted = await encryptPayload(
			JSON.stringify(payload),
			subscription.p256dh,
			subscription.auth,
		);

		return fetch(subscription.endpoint, {
			method: "POST",
			headers: {
				Authorization: authorization,
				"Content-Encoding": "aes128gcm",
				"Content-Type": "application/octet-stream",
				TTL: "86400",
			},
			body: encrypted.ciphertext.buffer as ArrayBuffer,
		});
	};
}
