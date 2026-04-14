import type { InferSelectModel } from "drizzle-orm";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { users } from "@/db/identity/table";
import { getDb } from "@/db/setup";
import { comments } from "./table";

export type Comment = InferSelectModel<typeof comments>;

export interface CommentWithAuthor {
	id: string;
	postId: string;
	authorId: string;
	body: string;
	createdAt: Date;
	updatedAt: Date;
	author: { id: string; name: string };
}

export async function createComment(input: {
	postId: string;
	authorId: string;
	body: string;
}): Promise<Comment> {
	const rows = await getDb()
		.insert(comments)
		.values({ id: crypto.randomUUID(), ...input })
		.returning();

	const row = rows[0];
	if (!row) throw new Error("createComment: insert returned no rows");
	return row;
}

export async function listCommentsByPost(postId: string): Promise<CommentWithAuthor[]> {
	const rows = await getDb()
		.select({
			comment: comments,
			author: { id: users.id, name: users.name },
		})
		.from(comments)
		.leftJoin(users, eq(comments.authorId, users.id))
		.where(and(eq(comments.postId, postId), isNull(comments.deletedAt)))
		.orderBy(asc(comments.createdAt));

	return rows.map((row) => ({
		id: row.comment.id,
		postId: row.comment.postId,
		authorId: row.comment.authorId,
		body: row.comment.body,
		createdAt: row.comment.createdAt,
		updatedAt: row.comment.updatedAt,
		author: { id: row.author?.id ?? "", name: row.author?.name ?? "" },
	}));
}

export async function getCommentById(id: string): Promise<Comment | null> {
	const rows = await getDb()
		.select()
		.from(comments)
		.where(and(eq(comments.id, id), isNull(comments.deletedAt)));

	return rows[0] ?? null;
}

export async function updateCommentBody(id: string, body: string): Promise<Comment | null> {
	const rows = await getDb()
		.update(comments)
		.set({ body, updatedAt: new Date() })
		.where(and(eq(comments.id, id), isNull(comments.deletedAt)))
		.returning();

	return rows[0] ?? null;
}

export async function softDeleteComment(id: string): Promise<Comment | null> {
	const rows = await getDb()
		.update(comments)
		.set({ deletedAt: new Date() })
		.where(and(eq(comments.id, id), isNull(comments.deletedAt)))
		.returning();

	return rows[0] ?? null;
}

export async function countCommentsByPosts(postIds: string[]): Promise<Map<string, number>> {
	if (postIds.length === 0) return new Map();

	const rows = await getDb()
		.select({ postId: comments.postId, count: count() })
		.from(comments)
		.where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
		.groupBy(comments.postId);

	const map = new Map<string, number>();
	for (const row of rows) {
		map.set(row.postId, row.count);
	}
	return map;
}
