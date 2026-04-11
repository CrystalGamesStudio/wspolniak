export async function generateToken(): Promise<{ plaintext: string; hash: string }> {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	const plaintext = base64UrlEncode(bytes);

	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plaintext));
	const hash = Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return { plaintext, hash };
}

function base64UrlEncode(bytes: Uint8Array): string {
	const binary = String.fromCharCode(...bytes);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
