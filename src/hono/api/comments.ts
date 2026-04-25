// SPDX-License-Identifier: AGPL-3.0-or-later
import { canDeleteComment, canEditComment } from "@/core/authorization";
import { notifyNewComment } from "@/core/notify";
import { createSendWebPush } from "@/core/web-push";
import {
	createComment,
	getCommentById,
	listCommentsByPost,
	softDeleteComment,
	updateCommentBody,
} from "@/db/comments/queries";
import { createCommentSchema, updateCommentSchema } from "@/db/comments/schema";
import { getPostById } from "@/db/posts/queries";
import {
	deleteSubscriptionByEndpoint,
	getSubscriptionsByUserId,
} from "@/db/push-subscriptions/queries";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const commentsEndpoint = createHono();

commentsEndpoint.use("*", authMiddleware());

commentsEndpoint.get("/:postId/comments", async (c) => {
	const postId = c.req.param("postId");
	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const commentsList = await listCommentsByPost(postId);
	return c.json({ data: commentsList });
});

commentsEndpoint.post("/:postId/comments", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("postId");

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const body = await c.req.json();
	const result = createCommentSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const comment = await createComment({
		postId,
		authorId: user.userId,
		body: result.data.body,
	});

	if (c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY) {
		const baseSendPush = createSendWebPush({
			publicKey: c.env.VAPID_PUBLIC_KEY,
			privateKey: c.env.VAPID_PRIVATE_KEY,
			subject: `mailto:${c.env.VAPID_SUBJECT ?? "admin@wspolniak.app"}`,
		});
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
		const snippet = result.data.body.slice(0, 100);
		c.executionCtx.waitUntil(
			notifyNewComment(
				{
					getActiveSubscriptions: async () => [],
					getSubscriptionsByUserId,
					sendPush,
					deleteSubscription: deleteSubscriptionByEndpoint,
					onSendError: (endpoint, status) => {
						// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
						console.error("[push] send failed", { status, endpoint, postId, kind: "comment" });
					},
				},
				user.userId,
				user.name,
				post.authorId,
				postId,
				snippet,
			),
		);
	}

	return c.json({ data: comment }, 201);
});

commentsEndpoint.patch("/:postId/comments/:commentId", async (c) => {
	const user = c.get("user");
	const body = await c.req.json();
	const result = updateCommentSchema.safeParse(body);

	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const comment = await getCommentById(c.req.param("commentId"));
	if (!comment) {
		return c.json({ error: "Not found" }, 404);
	}

	if (!canEditComment(user, comment)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const updated = await updateCommentBody(comment.id, result.data.body);
	return c.json({ data: updated });
});

commentsEndpoint.delete("/:postId/comments/:commentId", async (c) => {
	const user = c.get("user");

	const comment = await getCommentById(c.req.param("commentId"));
	if (!comment) {
		return c.json({ error: "Not found" }, 404);
	}

	if (!canDeleteComment(user, comment)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	await softDeleteComment(comment.id);
	return c.json({ data: { id: comment.id } });
});

export default commentsEndpoint;
