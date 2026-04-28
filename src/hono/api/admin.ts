// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	createMember,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
	updateMemberNote,
} from "@/db/identity/queries";
import { getShareCode, setShareCode } from "@/db/instance/queries";
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
		note: m.note,
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

adminEndpoint.put("/members/:id/note", async (c) => {
	const userId = c.req.param("id");
	const body = await c.req.json<{ note?: string }>();
	const note = body.note?.trim() || null;
	const user = await updateMemberNote(userId, note);
	return c.json({ data: { id: user.id, note: user.note } });
});

adminEndpoint.get("/share-code", async (c) => {
	const code = await getShareCode();
	return c.json({ data: { code } });
});

adminEndpoint.put("/share-code", async (c) => {
	const body = await c.req.json<{ code?: string }>();
	const code = body.code?.trim();

	if (!code) return c.json({ error: "Code is required" }, 400);
	if (code.length > 20) return c.json({ error: "Code must be max 20 characters" }, 400);

	await setShareCode(code);
	return c.json({ data: { code } });
});

export default adminEndpoint;
