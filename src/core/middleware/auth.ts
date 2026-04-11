import { getCookie } from "@tanstack/react-start/server";
import {
	SESSION_COOKIE_NAME,
	type SessionPayload,
	verifySessionCookie,
} from "@/db/identity/session";

export async function getSessionUser(secret: string): Promise<SessionPayload | null> {
	const token = getCookie(SESSION_COOKIE_NAME);

	if (!token) {
		return null;
	}

	return verifySessionCookie(token, secret);
}
