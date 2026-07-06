// SPDX-License-Identifier: AGPL-3.0-or-later
import { canDeleteComment, canEditComment } from "@/core/authorization";
import { notifyMentions, notifyNewComment } from "@/core/notify";
import { buildPushDeps } from "@/core/push-deps";
import {
	countRepliesByComment,
	createComment,
	createReply,
	getCommentById,
	listCommentsByPost,
	MAX_REPLIES_PER_COMMENT,
	softDeleteComment,
	updateCommentBody,
} from "@/db/comments/queries";
import { createCommentSchema, createReplySchema, updateCommentSchema } from "@/db/comments/schema";
import { createMentions } from "@/db/mentions/queries";
import { getPostById } from "@/db/posts/queries";
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

commentsEndpoint.post("/:postId/comments/:commentId/replies", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("postId");
	const commentId = c.req.param("commentId");

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const parent = await getCommentById(commentId);
	if (!parent || parent.postId !== postId) {
		return c.json({ error: "Not found" }, 404);
	}

	// Płaskie wątki: brak reply-na-reply (parent musi być komentarzem głównym).
	if (parent.parentId !== null) {
		return c.json(
			{ error: "Nie można odpowiedzieć na odpowiedź", details: { code: "reply_on_reply" } },
			422,
		);
	}

	// Limit 5 reply — obowiązuje wszystkich, włącznie z adminem.
	const replyCount = await countRepliesByComment(commentId);
	if (replyCount >= MAX_REPLIES_PER_COMMENT) {
		return c.json(
			{
				error: `Osiągnięto limit ${MAX_REPLIES_PER_COMMENT} odpowiedzi`,
				details: { code: "reply_limit" },
			},
			422,
		);
	}

	const body = await c.req.json();
	const result = createReplySchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const reply = await createReply({
		postId,
		parentId: commentId,
		authorId: user.userId,
		body: result.data.body,
	});

	const mentionUserIds = result.data.mentions.map((m) => m.userId);
	if (mentionUserIds.length > 0) {
		await createMentions({ postId, commentId: reply.id, userIds: mentionUserIds });
	}

	const pushDeps = buildPushDeps(c.env, postId, "mention");
	if (pushDeps && mentionUserIds.length > 0) {
		c.executionCtx.waitUntil(
			notifyMentions(pushDeps, user.userId, user.name, mentionUserIds, postId),
		);
	}

	return c.json({ data: reply }, 201);
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

	const mentionUserIds = result.data.mentions.map((m) => m.userId);
	if (mentionUserIds.length > 0) {
		await createMentions({ postId, commentId: comment.id, userIds: mentionUserIds });
	}

	const snippet = result.data.body.slice(0, 100);
	const pushDeps = buildPushDeps(c.env, postId, "comment");
	if (pushDeps) {
		c.executionCtx.waitUntil(
			notifyNewComment(pushDeps, user.userId, user.name, post.authorId, postId, snippet),
		);
		if (mentionUserIds.length > 0) {
			c.executionCtx.waitUntil(
				notifyMentions(pushDeps, user.userId, user.name, mentionUserIds, postId),
			);
		}
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
