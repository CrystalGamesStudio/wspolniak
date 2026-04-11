export const SESSION_COOKIE_NAME = "session";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

interface SessionUser {
	id: string;
	name: string;
	role: string;
}

export interface SessionPayload {
	userId: string;
	name: string;
	role: string;
}

export async function createSessionCookie(user: SessionUser, secret: string): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		userId: user.id,
		name: user.name,
		role: user.role,
		iat: now,
		exp: now + ONE_YEAR_SECONDS,
	};

	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	const key = await importKey(secret);
	const signature = await sign(key, signingInput);

	return `${signingInput}.${signature}`;
}

export async function verifySessionCookie(
	token: string,
	secret: string,
): Promise<SessionPayload | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	const [encodedHeader, encodedPayload, signature] = parts;
	if (!encodedHeader || !encodedPayload || !signature) return null;

	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const key = await importKey(secret);
	const expectedSignature = await sign(key, signingInput);

	if (signature !== expectedSignature) return null;

	try {
		const payload = JSON.parse(base64UrlDecode(encodedPayload));
		const now = Math.floor(Date.now() / 1000);
		if (typeof payload.exp === "number" && payload.exp < now) return null;

		return {
			userId: payload.userId,
			name: payload.name,
			role: payload.role,
		};
	} catch {
		return null;
	}
}

function base64UrlEncode(str: string): string {
	const bytes = new TextEncoder().encode(str);
	const binary = String.fromCharCode(...bytes);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

async function importKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function sign(key: CryptoKey, data: string): Promise<string> {
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
	const binary = String.fromCharCode(...new Uint8Array(signature));
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
