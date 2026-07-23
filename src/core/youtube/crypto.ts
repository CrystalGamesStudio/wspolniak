// SPDX-License-Identifier: AGPL-3.0-or-later
// AES-GCM encryption of the YouTube refresh token at rest.
// The IV is stored alongside the ciphertext (iv || ciphertext), base64-encoded.

const IV_LENGTH = 12; // 96-bit IV — recommended for AES-GCM

export async function importEncryptionKey(rawKeyBase64: string): Promise<CryptoKey> {
	const raw = base64ToBytes(rawKeyBase64);
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptRefreshToken(plaintext: string, key: CryptoKey): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

	const out = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
	out.set(iv, 0);
	out.set(new Uint8Array(ciphertext), IV_LENGTH);
	return bytesToBase64(out);
}

export async function decryptRefreshToken(stored: string, key: CryptoKey): Promise<string> {
	const bytes = base64ToBytes(stored);
	const iv = bytes.slice(0, IV_LENGTH);
	const ciphertext = bytes.slice(IV_LENGTH);
	const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
	return new TextDecoder().decode(plain);
}

function base64ToBytes(b64: string) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}
