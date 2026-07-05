// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	createMember,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "@/db/identity/queries";
import {
	getMaintenanceConfig,
	getShareCode,
	setShareCode,
	updateMaintenance,
} from "@/db/instance/queries";
import { createHono, getOrigin } from "@/hono/factory";
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
	const magicLink = `${getOrigin(c)}/app/u/${plaintextToken}`;

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
	const magicLink = `${getOrigin(c)}/app/u/${plaintextToken}`;

	return c.json({ data: { magicLink } });
});

adminEndpoint.delete("/members/:id", async (c) => {
	const userId = c.req.param("id");
	await softDeleteMember(userId);
	return c.json({ data: { deleted: true } });
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

adminEndpoint.get("/maintenance", async (c) => {
	const config = await getMaintenanceConfig();
	return c.json({ data: config });
});

adminEndpoint.put("/maintenance", async (c) => {
	const body = await c.req.json<{
		enabled?: boolean;
		message?: string;
		subtitle?: string;
		icon?: string;
	}>();

	const message = body.message?.trim();
	const subtitle = body.subtitle?.trim();
	const icon = body.icon?.trim();

	if (message !== undefined && message.length > 200) {
		return c.json({ error: "Message max 200 characters" }, 400);
	}
	if (subtitle !== undefined && subtitle.length > 100) {
		return c.json({ error: "Subtitle max 100 characters" }, 400);
	}
	if (icon !== undefined && icon.length > 50) {
		return c.json({ error: "Icon max 50 characters" }, 400);
	}

	const update: {
		enabled?: boolean;
		message?: string;
		subtitle?: string;
		icon?: string;
	} = {};
	if (typeof body.enabled === "boolean") update.enabled = body.enabled;
	if (message) update.message = message;
	if (subtitle) update.subtitle = subtitle;
	if (icon) update.icon = icon;

	await updateMaintenance(update);
	const config = await getMaintenanceConfig();
	return c.json({ data: config });
});

export default adminEndpoint;
