// SPDX-License-Identifier: AGPL-3.0-or-later

import { getActiveBan } from "@/db/identity/ban-queries";
import { createHono, getOrigin } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const appEndpoint = createHono();

appEndpoint.use("*", authMiddleware());

appEndpoint.get("/me", (c) => {
	const user = c.get("user");
	return c.json({ data: user });
});

appEndpoint.get("/me/ban-status", async (c) => {
	const user = c.get("user");
	const ban = await getActiveBan(user.userId);

	if (!ban) {
		return c.json({ data: { banned: false } });
	}

	return c.json({
		data: {
			banned: true,
			expiresAt: ban.expiresAt,
		},
	});
});

appEndpoint.get("/config", (c) => {
	return c.json({ data: { appUrl: getOrigin(c) } });
});

export default appEndpoint;
