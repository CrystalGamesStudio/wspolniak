// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	findActiveUserById,
	listActiveMembers,
	regenerateMemberToken,
} from "@/db/identity/queries";
import { getShareCode } from "@/db/instance/queries";
import { createHono } from "@/hono/factory";

const shareEndpoint = createHono();

shareEndpoint.post("/verify", async (c) => {
	const body = await c.req.json<{ code?: string }>();
	const code = body.code;
	const storedCode = await getShareCode();

	if (!storedCode || code !== storedCode) {
		return c.json({ error: "Invalid code" }, 401);
	}

	const members = await listActiveMembers();
	const memberList = members
		.filter((m) => m.role === "member")
		.map((m) => ({ id: m.id, name: m.name }));

	return c.json({ members: memberList });
});

shareEndpoint.post("/login", async (c) => {
	const body = await c.req.json<{ code?: string; memberId?: string }>();
	const storedCode = await getShareCode();

	if (!storedCode || body.code !== storedCode) {
		return c.json({ error: "Invalid code" }, 401);
	}

	const user = await findActiveUserById(body.memberId ?? "");
	if (!user) {
		return c.json({ error: "Member not found" }, 404);
	}

	if (user.role !== "member") {
		return c.json({ error: "Forbidden" }, 403);
	}

	const { plaintextToken } = await regenerateMemberToken(user.id);
	return c.json({ redirectUrl: `/app/u/${plaintextToken}` });
});

export default shareEndpoint;
