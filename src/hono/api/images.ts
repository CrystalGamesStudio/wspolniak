// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";
import { createDirectUploadUrl, createDirectUploadUrlBatch } from "@/images/client";
import { batchUploadUrlSchema } from "@/images/schema";

const imagesEndpoint = createHono();

imagesEndpoint.use("*", authMiddleware());

imagesEndpoint.post("/upload-url", async (c) => {
	const result = await createDirectUploadUrl({
		accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: c.env.CLOUDFLARE_IMAGES_API_TOKEN,
	});

	return c.json({ data: result });
});

// Batch (issue #95): jeden request zwraca N par {cfImageId, uploadURL} zamiast N round-tripów.
imagesEndpoint.post("/upload-urls", async (c) => {
	const parsed = batchUploadUrlSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: "Invalid count" }, 400);
	}

	const data = await createDirectUploadUrlBatch(
		{
			accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: c.env.CLOUDFLARE_IMAGES_API_TOKEN,
		},
		parsed.data.count,
	);

	return c.json({ data });
});

export default imagesEndpoint;
