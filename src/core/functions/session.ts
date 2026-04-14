// SPDX-License-Identifier: AGPL-3.0-or-later
import { createServerFn } from "@tanstack/react-start";
import { getSessionUser } from "@/core/middleware/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const { env } = await import("cloudflare:workers");
	return getSessionUser(env.SESSION_SECRET);
});
