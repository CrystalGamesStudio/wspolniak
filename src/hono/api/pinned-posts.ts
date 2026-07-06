// SPDX-License-Identifier: AGPL-3.0-or-later
import { canPinPost } from "@/core/authorization";
import { PinnedLimitError, pinPost, unpinPost } from "@/db/pinned-posts";
import { getPostById } from "@/db/posts/queries";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";

const pinnedPostsEndpoint = createHono();

pinnedPostsEndpoint.use("*", authMiddleware());

pinnedPostsEndpoint.post("/:id/pin", async (c) => {
	const user = c.get("user");
	if (!canPinPost(user)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}

	try {
		await pinPost(post.id);
	} catch (error) {
		if (error instanceof PinnedLimitError) {
			return c.json({ error: "Osiągnięto limit przypiętych postów (3)" }, 422);
		}
		throw error;
	}
	return c.json({ data: { id: post.id, pinned: true } });
});

pinnedPostsEndpoint.delete("/:id/pin", async (c) => {
	const user = c.get("user");
	if (!canPinPost(user)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	await unpinPost(c.req.param("id"));
	return c.json({ data: { id: c.req.param("id"), pinned: false } });
});

export default pinnedPostsEndpoint;
