// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";
import { createStreamUploadUrl } from "@/stream/client";

const videosEndpoint = createHono();

videosEndpoint.use("*", authMiddleware());

videosEndpoint.post("/upload-url", async (c) => {
	const result = await createStreamUploadUrl({
		accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: c.env.CLOUDFLARE_STREAM_API_TOKEN,
	});

	return c.json({ data: result });
});

export default videosEndpoint;
