// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { userBans } from "./bans";

export type UserBan = InferSelectModel<typeof userBans>;

export async function createBan(input: {
	userId: string;
	bannedBy: string;
	expiresAt: Date;
}): Promise<UserBan> {
	const db = getDb();

	const rows = await db
		.insert(userBans)
		.values({
			id: crypto.randomUUID(),
			userId: input.userId,
			bannedBy: input.bannedBy,
			expiresAt: input.expiresAt,
		})
		.returning();

	const row = rows[0];
	if (!row) throw new Error("createBan: no rows returned");
	return row;
}

export async function getActiveBan(userId: string): Promise<UserBan | null> {
	const db = getDb();

	const rows = await db
		.select()
		.from(userBans)
		.where(and(eq(userBans.userId, userId), gt(userBans.expiresAt, new Date())))
		.limit(1);

	return rows[0] ?? null;
}

export async function removeBan(userId: string): Promise<void> {
	const db = getDb();

	await db.delete(userBans).where(eq(userBans.userId, userId));
}
