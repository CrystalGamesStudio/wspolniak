// SPDX-License-Identifier: AGPL-3.0-or-later
import { decryptRefreshToken, encryptRefreshToken, importEncryptionKey } from "./crypto";

// Deterministic 32-byte test keys (base64 of raw bytes filled with a single value).
function keyFromByte(byte: number): string {
	return btoa(String.fromCharCode(...new Uint8Array(32).fill(byte)));
}
const ZERO_KEY_B64 = keyFromByte(0);
const ONE_KEY_B64 = keyFromByte(1);

describe("importEncryptionKey", () => {
	it("returns a CryptoKey usable for AES-GCM", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		expect(key).toBeInstanceOf(CryptoKey);
		const ct = await encryptRefreshToken("x", key);
		expect(await decryptRefreshToken(ct, key)).toBe("x");
	});
});

describe("youtube token encryption (AES-GCM at rest)", () => {
	it("round-trips: decrypt(encrypt(x)) === x", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		const ct = await encryptRefreshToken("ya29.secret-refresh-token", key);
		expect(await decryptRefreshToken(ct, key)).toBe("ya29.secret-refresh-token");
	});

	it("ciphertext is not the plaintext (token is never stored raw)", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		const plain = "ya29.secret-refresh-token";
		const ct = await encryptRefreshToken(plain, key);
		expect(ct).not.toBe(plain);
		expect(ct).not.toContain(plain);
	});

	it("produces different ciphertexts for the same plaintext (random IV)", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		const a = await encryptRefreshToken("same-token", key);
		const b = await encryptRefreshToken("same-token", key);
		expect(a).not.toBe(b);
		expect(await decryptRefreshToken(a, key)).toBe("same-token");
		expect(await decryptRefreshToken(b, key)).toBe("same-token");
	});

	it("rejects tampered ciphertext (auth tag check)", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		const ct = await encryptRefreshToken("secret", key);

		// Flip the last byte (part of the GCM auth tag) and re-encode.
		const bytes = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
		bytes[bytes.length - 1] ^= 0xff;
		const tampered = btoa(String.fromCharCode(...bytes));

		await expect(decryptRefreshToken(tampered, key)).rejects.toThrow();
	});

	it("rejects ciphertext encrypted under a different key", async () => {
		const key = await importEncryptionKey(ZERO_KEY_B64);
		const other = await importEncryptionKey(ONE_KEY_B64);
		const ct = await encryptRefreshToken("secret", key);
		await expect(decryptRefreshToken(ct, other)).rejects.toThrow();
	});
});
