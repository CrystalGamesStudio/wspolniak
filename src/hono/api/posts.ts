import { canDeletePost, canEditPost } from "@/core/authorization";
import { notifyNewPost } from "@/core/notify";
import { createSendWebPush } from "@/core/web-push";
import { countCommentsByPosts } from "@/db/comments/queries";
import {
	countUserPostsToday,
	createPost,
	getPostById,
	listPaginatedPosts,
	softDeletePost,
	updatePostDescription,
} from "@/db/posts/queries";
import { createPostSchema, updatePostSchema } from "@/db/posts/schema";
import {
	deleteSubscriptionByEndpoint,
	getActiveSubscriptions,
} from "@/db/push-subscriptions/queries";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const DAILY_POST_LIMIT = 50;

const postsEndpoint = createHono();

postsEndpoint.use("*", authMiddleware());

postsEndpoint.post("/", async (c) => {
	const user = c.get("user");
	const body = await c.req.json();
	const result = createPostSchema.safeParse(body);

	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const todayCount = await countUserPostsToday(user.userId);
	if (todayCount >= DAILY_POST_LIMIT) {
		return c.json({ error: "Osiągnięto dzienny limit postów (50)" }, 429);
	}

	const post = await createPost({
		authorId: user.userId,
		description: result.data.description,
		cfImageIds: result.data.cfImageIds,
	});

	if (c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY) {
		const sendPush = createSendWebPush({
			publicKey: c.env.VAPID_PUBLIC_KEY,
			privateKey: c.env.VAPID_PRIVATE_KEY,
			subject: `mailto:${c.env.VAPID_SUBJECT ?? "admin@wspolniak.app"}`,
		});
		c.executionCtx.waitUntil(
			notifyNewPost(
				{
					getActiveSubscriptions,
					getSubscriptionsByUserId: async () => [],
					sendPush,
					deleteSubscription: deleteSubscriptionByEndpoint,
				},
				user.userId,
				user.name,
				post.post.id,
			),
		);
	}

	return c.json({ data: post.post }, 201);
});

postsEndpoint.get("/", async (c) => {
	const cursorParam = c.req.query("cursor");
	let cursor: { createdAt: string; id: string } | undefined;
	if (cursorParam) {
		const separatorIndex = cursorParam.lastIndexOf("_");
		cursor = {
			createdAt: cursorParam.slice(0, separatorIndex),
			id: cursorParam.slice(separatorIndex + 1),
		};
	}

	const result = await listPaginatedPosts({ limit: 20, cursor });
	const postIds = result.posts.map((p) => p.id);
	const commentCounts = await countCommentsByPosts(postIds);
	const postsWithComments = result.posts.map((p) => ({
		...p,
		commentCount: commentCounts.get(p.id) ?? 0,
	}));

	return c.json({
		data: postsWithComments,
		meta: { nextCursor: result.nextCursor, imageAccountHash: c.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH },
	});
});

postsEndpoint.get("/:id", async (c) => {
	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}
	return c.json({ data: post, meta: { imageAccountHash: c.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH } });
});

postsEndpoint.patch("/:id", async (c) => {
	const user = c.get("user");
	const body = await c.req.json();
	const result = updatePostSchema.safeParse(body);

	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	if (!canEditPost(user, post)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const updated = await updatePostDescription(post.id, result.data.description);
	return c.json({ data: updated });
});

postsEndpoint.delete("/:id", async (c) => {
	const user = c.get("user");

	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	if (!canDeletePost(user, post)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	await softDeletePost(post.id);
	return c.json({ data: { id: post.id } });
});

export default postsEndpoint;
