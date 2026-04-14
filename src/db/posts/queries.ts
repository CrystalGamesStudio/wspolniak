// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { users } from "@/db/identity/table";
import { getDb } from "@/db/setup";
import { postImages, posts } from "./table";

export type Post = InferSelectModel<typeof posts>;
export type PostImage = InferSelectModel<typeof postImages>;

interface CreatePostInput {
	authorId: string;
	description: string | null;
	cfImageIds: string[];
}

export async function createPost(input: CreatePostInput) {
	const { authorId, description, cfImageIds } = input;
	const db = getDb();

	const postId = crypto.randomUUID();
	const postRows = await db.insert(posts).values({ id: postId, authorId, description }).returning();
	const post = postRows[0];
	if (!post) throw new Error("createPost: insert returned no rows");

	const imageValues = cfImageIds.map((cfImageId, index) => ({
		id: crypto.randomUUID(),
		postId,
		cfImageId,
		displayOrder: index,
	}));

	const images = await db.insert(postImages).values(imageValues).returning();

	return { post, images };
}

interface PostWithAuthorAndImages {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
	author: { id: string; name: string };
	images: PostImage[];
}

type PostJoinRow = {
	post: Post;
	author: { id: string; name: string } | null;
	image: PostImage | null;
};

function aggregatePostRows(rows: PostJoinRow[]): PostWithAuthorAndImages[] {
	const postsMap = new Map<string, PostWithAuthorAndImages>();

	for (const row of rows) {
		const existing = postsMap.get(row.post.id);
		if (existing) {
			if (row.image) existing.images.push(row.image);
		} else {
			postsMap.set(row.post.id, {
				id: row.post.id,
				authorId: row.post.authorId,
				description: row.post.description,
				createdAt: row.post.createdAt,
				updatedAt: row.post.updatedAt,
				author: { id: row.author?.id ?? "", name: row.author?.name ?? "" },
				images: row.image ? [row.image] : [],
			});
		}
	}

	return [...postsMap.values()];
}

export async function listRecentPosts(limit: number): Promise<PostWithAuthorAndImages[]> {
	const rows = await getDb()
		.select({
			post: posts,
			author: { id: users.id, name: users.name },
			image: postImages,
		})
		.from(posts)
		.leftJoin(users, eq(posts.authorId, users.id))
		.leftJoin(postImages, eq(posts.id, postImages.postId))
		.where(isNull(posts.deletedAt))
		.orderBy(desc(posts.createdAt))
		.limit(limit);

	return aggregatePostRows(rows);
}

interface PaginatedPostsInput {
	limit: number;
	cursor?: { createdAt: string; id: string };
}

interface PaginatedPostsResult {
	posts: PostWithAuthorAndImages[];
	nextCursor: { createdAt: string; id: string } | null;
}

export async function listPaginatedPosts(
	input: PaginatedPostsInput,
): Promise<PaginatedPostsResult> {
	const { limit, cursor } = input;
	const fetchLimit = limit + 1;

	const conditions = [isNull(posts.deletedAt)];
	if (cursor) {
		const cursorDate = new Date(cursor.createdAt);
		conditions.push(
			sql`(${posts.createdAt} < ${cursorDate} OR (${posts.createdAt} = ${cursorDate} AND ${posts.id} < ${cursor.id}))`,
		);
	}

	const rows = await getDb()
		.select({
			post: posts,
			author: { id: users.id, name: users.name },
			image: postImages,
		})
		.from(posts)
		.leftJoin(users, eq(posts.authorId, users.id))
		.leftJoin(postImages, eq(posts.id, postImages.postId))
		.where(and(...conditions))
		.orderBy(desc(posts.createdAt), desc(posts.id))
		.limit(fetchLimit);

	const allPosts = aggregatePostRows(rows);
	const hasMore = allPosts.length > limit;
	const resultPosts = hasMore ? allPosts.slice(0, limit) : allPosts;

	const lastPost = resultPosts[resultPosts.length - 1];
	const nextCursor =
		hasMore && lastPost ? { createdAt: lastPost.createdAt.toISOString(), id: lastPost.id } : null;

	return { posts: resultPosts, nextCursor };
}

export async function getPostById(id: string): Promise<PostWithAuthorAndImages | null> {
	const rows = await getDb()
		.select({
			post: posts,
			author: { id: users.id, name: users.name },
			image: postImages,
		})
		.from(posts)
		.leftJoin(users, eq(posts.authorId, users.id))
		.leftJoin(postImages, eq(posts.id, postImages.postId))
		.where(and(eq(posts.id, id), isNull(posts.deletedAt)));

	const first = rows[0];
	if (!first) return null;
	const images: PostImage[] = [];
	for (const row of rows) {
		if (row.image) images.push(row.image);
	}

	return {
		id: first.post.id,
		authorId: first.post.authorId,
		description: first.post.description,
		createdAt: first.post.createdAt,
		updatedAt: first.post.updatedAt,
		author: { id: first.author?.id ?? "", name: first.author?.name ?? "" },
		images,
	};
}

export async function updatePostDescription(
	id: string,
	description: string | null,
): Promise<Post | null> {
	const rows = await getDb()
		.update(posts)
		.set({ description, updatedAt: new Date() })
		.where(and(eq(posts.id, id), isNull(posts.deletedAt)))
		.returning();

	return rows[0] ?? null;
}

export async function softDeletePost(id: string): Promise<Post | null> {
	const rows = await getDb()
		.update(posts)
		.set({ deletedAt: new Date() })
		.where(and(eq(posts.id, id), isNull(posts.deletedAt)))
		.returning();

	return rows[0] ?? null;
}

export async function countUserPostsToday(userId: string): Promise<number> {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const rows = await getDb()
		.select({ count: count() })
		.from(posts)
		.where(and(eq(posts.authorId, userId), gte(posts.createdAt, startOfDay)));

	return rows[0]?.count ?? 0;
}
