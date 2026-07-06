// SPDX-License-Identifier: AGPL-3.0-or-later

import { listMembersForMentions } from "@/db/identity/queries";
import { createHono, getOrigin } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const appEndpoint = createHono();

appEndpoint.use("*", authMiddleware());

appEndpoint.get("/me", (c) => {
	const user = c.get("user");
	return c.json({ data: user });
});

appEndpoint.get("/config", (c) => {
	return c.json({ data: { appUrl: getOrigin(c) } });
});

appEndpoint.get("/users", async (c) => {
	const members = await listMembersForMentions(c.req.query("q"));
	return c.json({ data: members });
});

export default appEndpoint;
