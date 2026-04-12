import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";
import { createDirectUploadUrl } from "@/images/client";

const imagesEndpoint = createHono();

imagesEndpoint.use("*", authMiddleware());

imagesEndpoint.post("/upload-url", async (c) => {
	const result = await createDirectUploadUrl({
		accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: c.env.CLOUDFLARE_IMAGES_API_TOKEN,
	});

	return c.json({ data: result });
});

export default imagesEndpoint;
