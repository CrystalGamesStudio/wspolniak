// SPDX-License-Identifier: AGPL-3.0-or-later
import { canDeletePost, canEditPost } from "@/core/authorization";
import { notifyNewPost } from "@/core/notify";
import { createSendWebPushFromEnv } from "@/core/web-push";
import { countCommentsByPosts } from "@/db/comments/queries";
import {
	addPostImages,
	countUserPostsToday,
	createPost,
	deletePostImage,
	getPostById,
	listPaginatedPosts,
	reorderPostImages,
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
		cfImageIds: result.data.cfImageIds ?? [],
	});

	const baseSendPush = createSendWebPushFromEnv(c.env);
	if (baseSendPush) {
		const sendPush: typeof baseSendPush = async (subscription, payload) => {
			try {
				const res = await baseSendPush(subscription, payload);
				if (!res.ok && res.status !== 410) {
					const body = await res
						.clone()
						.text()
						.catch(() => "<no body>");
					// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
					console.error("[push] non-OK response", {
						status: res.status,
						endpoint: subscription.endpoint,
						body,
					});
				}
				return res;
			} catch (error) {
				// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
				console.error("[push] threw", { endpoint: subscription.endpoint, error: String(error) });
				throw error;
			}
		};
		c.executionCtx.waitUntil(
			notifyNewPost(
				{
					getActiveSubscriptions,
					getSubscriptionsByUserId: async () => [],
					sendPush,
					deleteSubscription: deleteSubscriptionByEndpoint,
					onSendError: (endpoint, status) => {
						// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
						console.error("[push] send failed", {
							status,
							endpoint,
							postId: post.post.id,
							kind: "post",
						});
					},
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

	const result = await listPaginatedPosts({ limit: 10, cursor });
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

	const { cfImageIds, imageOrder } = result.data;

	if (imageOrder) {
		const knownIds = new Set(post.images.map((img) => img.id));
		const hasUnknown = imageOrder.some((id) => !knownIds.has(id));
		if (hasUnknown) {
			return c.json({ error: "imageOrder contains unknown image ids" }, 400);
		}
		await reorderPostImages(post.id, imageOrder);
	}

	if (cfImageIds && cfImageIds.length > 0) {
		await addPostImages(post.id, cfImageIds, post.images.length);
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

postsEndpoint.delete("/:id/images/:imageId", async (c) => {
	const user = c.get("user");

	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	if (!canEditPost(user, post)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const deleted = await deletePostImage(post.id, c.req.param("imageId"));
	if (!deleted) {
		return c.json({ error: "Not found" }, 404);
	}

	return c.json({ data: { id: deleted.id } });
});

// Public endpoint for shared posts (no auth required)
const publicPostsEndpoint = createHono();

publicPostsEndpoint.get("/:id", async (c) => {
	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}
	return c.json({ data: post, meta: { imageAccountHash: c.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH } });
});

export { publicPostsEndpoint };
export default postsEndpoint;
