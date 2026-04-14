import { deleteSubscriptionByEndpoint, saveSubscription } from "@/db/push-subscriptions/queries";
import { subscribeSchema, unsubscribeSchema } from "@/db/push-subscriptions/schema";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const pushEndpoint = createHono();

pushEndpoint.get("/vapid-key", async (c) => {
	const key = c.env.VAPID_PUBLIC_KEY;
	if (!key) {
		return c.json({ error: "Push not configured" }, 503);
	}
	return c.json({ data: { publicKey: key } });
});

pushEndpoint.use("*", authMiddleware());

pushEndpoint.post("/subscribe", async (c) => {
	const user = c.get("user");
	const body = await c.req.json();
	const result = subscribeSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const subscription = await saveSubscription({
		userId: user.userId,
		endpoint: result.data.endpoint,
		p256dh: result.data.keys.p256dh,
		auth: result.data.keys.auth,
	});

	return c.json({ data: subscription }, 201);
});

pushEndpoint.delete("/subscribe", async (c) => {
	const body = await c.req.json();
	const result = unsubscribeSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	await deleteSubscriptionByEndpoint(result.data.endpoint);
	return c.json({ data: { ok: true } });
});

export default pushEndpoint;
