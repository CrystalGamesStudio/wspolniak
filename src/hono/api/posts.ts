import { countUserPostsToday, createPost, getPostById, listRecentPosts } from "@/db/posts/queries";
import { createPostSchema } from "@/db/posts/schema";
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

	return c.json({ data: post.post }, 201);
});

postsEndpoint.get("/", async (c) => {
	const posts = await listRecentPosts(50);
	return c.json({ data: posts, meta: { imageAccountHash: c.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH } });
});

postsEndpoint.get("/:id", async (c) => {
	const post = await getPostById(c.req.param("id"));
	if (!post) {
		return c.json({ error: "Not found" }, 404);
	}
	return c.json({ data: post, meta: { imageAccountHash: c.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH } });
});

export default postsEndpoint;
