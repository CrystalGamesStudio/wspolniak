import { canDeleteComment, canEditComment } from "@/core/authorization";
import {
	createComment,
	getCommentById,
	listCommentsByPost,
	softDeleteComment,
	updateCommentBody,
} from "@/db/comments/queries";
import { createCommentSchema, updateCommentSchema } from "@/db/comments/schema";
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
