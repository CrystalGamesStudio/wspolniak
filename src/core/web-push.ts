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

	const privateKeyBytes = base64ToUint8Array(input.privateKey);
	const key = await crypto.subtle.importKey(
		"pkcs8",
		privateKeyBytes.buffer as ArrayBuffer,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);

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
