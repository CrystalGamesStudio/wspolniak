// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	getReactionCounts,
	getReactionsWithUsers,
	getUserReaction,
	upsertReaction,
} from "@/db/post-reactions/queries";
import { upsertReactionSchema } from "@/db/post-reactions/schema";
import { getPostById } from "@/db/posts/queries";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const reactionsEndpoint = createHono();

reactionsEndpoint.use("*", authMiddleware());

reactionsEndpoint.post("/:postId/reactions", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("postId");

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const body = await c.req.json();
	const result = upsertReactionSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Validation failed", details: result.error.flatten() }, 400);
	}

	const reaction = await upsertReaction({
		postId,
		userId: user.userId,
		reactionType: result.data.reactionType,
	});

	return c.json({ data: reaction });
});

reactionsEndpoint.get("/:postId/reactions", async (c) => {
	const postId = c.req.param("postId");

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const countsMap = await getReactionCounts(postId);
	const counts: Record<string, number> = {};
	for (const [type, count] of countsMap) {
		counts[type] = count;
	}

	return c.json({ data: counts });
});

reactionsEndpoint.get("/:postId/my-reaction", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("postId");

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const reaction = await getUserReaction(postId, user.userId);
	return c.json({ data: reaction });
});

reactionsEndpoint.get("/:postId/reactions/users", async (c) => {
	const user = c.get("user");
	const postId = c.req.param("postId");

	if (user.role !== "admin") {
		return c.json({ error: "Forbidden" }, 403);
	}

	const post = await getPostById(postId);
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	const reactions = await getReactionsWithUsers(postId);
	return c.json({ data: reactions });
});

export default reactionsEndpoint;
