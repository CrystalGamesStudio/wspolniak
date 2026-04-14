// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod/v4";
import { generateToken } from "@/db/identity/crypto";
import { createUser } from "@/db/identity/queries";
import { completeSetup, isSetupCompleted } from "@/db/instance/queries";
import { createHono } from "@/hono/factory";

const setupBodySchema = z.object({
	familyName: z.string().min(1),
	adminName: z.string().min(1),
});

const setupRoute = createHono();

setupRoute.post("/", async (c) => {
	const completed = await isSetupCompleted();
	if (completed) {
		return c.body(null, 404);
	}

	const body = await c.req.json();
	const result = setupBodySchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const { familyName, adminName } = result.data;

	const { plaintext, hash } = await generateToken();
	await completeSetup(familyName);
	await createUser({ name: adminName, role: "admin", tokenHash: hash });

	const host = new URL(c.req.url).origin;
	return c.json({ magicLink: `${host}/app/u/${plaintext}` });
});

export default setupRoute;
