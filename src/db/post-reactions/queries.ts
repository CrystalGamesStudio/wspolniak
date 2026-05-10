// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import type { ReactionType } from "./table";
import { postReactions } from "./table";

export type PostReaction = InferSelectModel<typeof postReactions>;

interface UpsertReactionInput {
	postId: string;
	userId: string;
	reactionType: ReactionType;
}

export async function upsertReaction(input: UpsertReactionInput): Promise<PostReaction> {
	const { postId, userId, reactionType } = input;
	const db = getDb();

	const rows = await db
		.insert(postReactions)
		.values({
			id: crypto.randomUUID(),
			postId,
			userId,
			reactionType,
		})
		.onConflictDoUpdate({
			target: [postReactions.postId, postReactions.userId],
			set: { reactionType, updatedAt: new Date() },
		})
		.returning();

	const row = rows[0];
	if (!row) throw new Error("upsertReaction: no rows returned");
	return row;
}

export async function getReactionCounts(postId: string): Promise<Map<ReactionType, number>> {
	const db = getDb();

	const rows = await db
		.select({ reactionType: postReactions.reactionType, count: count() })
		.from(postReactions)
		.where(eq(postReactions.postId, postId))
		.groupBy(postReactions.reactionType);

	const result = new Map<ReactionType, number>();
	for (const row of rows) {
		result.set(row.reactionType as ReactionType, row.count);
	}
	return result;
}

export async function getUserReaction(
	postId: string,
	userId: string,
): Promise<PostReaction | null> {
	const db = getDb();

	const rows = await db
		.select()
		.from(postReactions)
		.where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)));

	return rows[0] ?? null;
}
