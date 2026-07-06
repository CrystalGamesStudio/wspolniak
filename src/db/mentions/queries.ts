// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { mentions } from "./table";

export type Mention = InferSelectModel<typeof mentions>;
export type NewMention = InferInsertModel<typeof mentions>;

/**
 * Bulk-insert wierszy mentions — jeden na (wspomniany userId).
 * Deduplikuje userIds przed insertem, żeby dwukrotne wspomnienie tej samej osoby
 * w jednym komentarzu nie tworzyło duplikatów.
 *
 * commentId === null oznacza mention na poziomie posta (opis); w przeciwnym razie
 * mention wiąże się z konkretnym komentarzem.
 */
export async function createMentions(input: {
	postId: string;
	commentId: string | null;
	userIds: string[];
}): Promise<Mention[]> {
	const userIds = [...new Set(input.userIds)];
	if (userIds.length === 0) return [];

	const rows = await getDb()
		.insert(mentions)
		.values(
			userIds.map((userId) => ({
				id: crypto.randomUUID(),
				postId: input.postId,
				commentId: input.commentId,
				userId,
			})),
		)
		.returning();

	return rows;
}

/**
 * Usuwa wszystkie mentions powiązane z postem. Używane przy edycji opisu posta —
 * najpierw czyścimy stare mentions, potem tworzymy nowe z aktualnej treści.
 */
export async function deleteMentionsByPost(postId: string): Promise<void> {
	await getDb().delete(mentions).where(eq(mentions.postId, postId));
}
