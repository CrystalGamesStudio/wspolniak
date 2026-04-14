import type { InferSelectModel } from "drizzle-orm";
import { eq, ne } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { pushSubscriptions } from "./table";

export type PushSubscription = InferSelectModel<typeof pushSubscriptions>;

export async function saveSubscription(input: {
	userId: string;
	endpoint: string;
	p256dh: string;
	auth: string;
}): Promise<PushSubscription> {
	const rows = await getDb()
		.insert(pushSubscriptions)
		.values({ id: crypto.randomUUID(), ...input })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: input.userId, p256dh: input.p256dh, auth: input.auth },
		})
		.returning();

	const row = rows[0];
	if (!row) throw new Error("saveSubscription: insert returned no rows");
	return row;
}

export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
	const rows = await getDb()
		.delete(pushSubscriptions)
		.where(eq(pushSubscriptions.endpoint, endpoint))
		.returning({ id: pushSubscriptions.id });

	return rows.length > 0;
}

export async function getActiveSubscriptions(excludeUserId: string): Promise<PushSubscription[]> {
	return getDb()
		.select()
		.from(pushSubscriptions)
		.where(ne(pushSubscriptions.userId, excludeUserId));
}

export async function getSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
	return getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
