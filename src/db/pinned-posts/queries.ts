// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { pinnedPosts } from "./table";

export type PinnedPost = InferSelectModel<typeof pinnedPosts>;

export const MAX_PINNED_POSTS = 3;

export class PinnedLimitError extends Error {
	constructor() {
		super("Osiągnięto limit przypiętych postów (3)");
		this.name = "PinnedLimitError";
	}
}

export async function pinPost(postId: string): Promise<PinnedPost> {
	const currentCount = await countPinnedPosts();
	if (currentCount >= MAX_PINNED_POSTS) {
		throw new PinnedLimitError();
	}
	const db = getDb();
	const rows = await db.insert(pinnedPosts).values({ id: crypto.randomUUID(), postId }).returning();
	const row = rows[0];
	if (!row) throw new Error("pinPost: insert returned no rows");
	return row;
}

export async function unpinPost(postId: string): Promise<PinnedPost | null> {
	const db = getDb();
	const rows = await db.delete(pinnedPosts).where(eq(pinnedPosts.postId, postId)).returning();
	return rows[0] ?? null;
}

export async function countPinnedPosts(): Promise<number> {
	const db = getDb();
	const rows = await db.select({ count: count() }).from(pinnedPosts);
	return rows[0]?.count ?? 0;
}

export async function listPinnedPostIds(): Promise<string[]> {
	const db = getDb();
	const rows = await db
		.select({ postId: pinnedPosts.postId })
		.from(pinnedPosts)
		.orderBy(desc(pinnedPosts.pinnedAt))
		.limit(3);
	return rows.map((r) => r.postId);
}
