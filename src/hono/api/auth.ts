// SPDX-License-Identifier: AGPL-3.0-or-later
import { setCookie } from "hono/cookie";
import { findUserByTokenHash } from "@/db/identity/queries";
import { createSessionCookie, SESSION_COOKIE_NAME } from "@/db/identity/session";
import { createHono } from "@/hono/factory";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const authRoute = createHono();

authRoute.get("/:token", async (c) => {
	const token = c.req.param("token");

	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	const tokenHash = Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const user = await findUserByTokenHash(tokenHash);

	if (!user) {
		return c.redirect("/auth/error");
	}

	const cookie = await createSessionCookie(user, c.env.SESSION_SECRET);

	const isSecure = new URL(c.req.url).protocol === "https:";

	setCookie(c, SESSION_COOKIE_NAME, cookie, {
		httpOnly: true,
		secure: isSecure,
		sameSite: "Lax",
		path: "/",
		maxAge: ONE_YEAR_SECONDS,
	});

	return c.redirect("/app");
});

export default authRoute;
