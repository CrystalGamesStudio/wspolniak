// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";
import { createStreamUploadUrl, getStreamVideoStatus } from "@/stream/client";

const videosEndpoint = createHono();

videosEndpoint.use("*", authMiddleware());

videosEndpoint.post("/upload-url", async (c) => {
	const result = await createStreamUploadUrl({
		accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: c.env.CLOUDFLARE_STREAM_API_TOKEN,
	});

	return c.json({ data: result });
});

videosEndpoint.get("/:uid/status", async (c) => {
	const uid = c.req.param("uid");
	const result = await getStreamVideoStatus({
		accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: c.env.CLOUDFLARE_STREAM_API_TOKEN,
		uid,
	});

	return c.json({ data: result });
});

export default videosEndpoint;
