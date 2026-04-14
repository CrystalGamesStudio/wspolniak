// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	createMember,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "@/db/identity/queries";
import { createHono } from "@/hono/factory";
import { adminMiddleware } from "@/hono/middleware/admin";
import { authMiddleware } from "@/hono/middleware/auth";

const adminEndpoint = createHono();

adminEndpoint.use("*", authMiddleware());
adminEndpoint.use("*", adminMiddleware());

adminEndpoint.post("/members", async (c) => {
	const body = await c.req.json<{ name?: string }>();
	const name = body.name?.trim();

	if (!name) {
		return c.json({ error: "Name is required" }, 400);
	}

	const { user, plaintextToken } = await createMember(name);
	const url = new URL(c.req.url);
	const magicLink = `${url.origin}/app/u/${plaintextToken}`;

	return c.json(
		{ data: { user: { id: user.id, name: user.name, role: user.role }, magicLink } },
		201,
	);
});

adminEndpoint.get("/members", async (c) => {
	const members = await listActiveMembers();
	const data = members.map((m) => ({
		id: m.id,
		name: m.name,
		role: m.role,
		createdAt: m.createdAt,
	}));
	return c.json({ data });
});

adminEndpoint.post("/members/:id/regenerate", async (c) => {
	const userId = c.req.param("id");
	const { plaintextToken } = await regenerateMemberToken(userId);
	const url = new URL(c.req.url);
	const magicLink = `${url.origin}/app/u/${plaintextToken}`;

	return c.json({ data: { magicLink } });
});

adminEndpoint.delete("/members/:id", async (c) => {
	const userId = c.req.param("id");
	await softDeleteMember(userId);
	return c.json({ data: { deleted: true } });
});

export default adminEndpoint;
