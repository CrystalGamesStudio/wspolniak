// SPDX-License-Identifier: AGPL-3.0-or-later

import { canDeletePost } from "@/core/authorization";
import { countUserVideoUploadsToday, deletePostVideo, getVideoById } from "@/db/posts/queries";
import { createHono } from "@/hono/factory";
import { authMiddleware } from "@/hono/middleware/auth";
import { createStreamUploadUrl, deleteStreamVideo, getStreamVideoStatus } from "@/stream/client";

const DAILY_VIDEO_LIMIT = 5;

const videosEndpoint = createHono();

videosEndpoint.use("*", authMiddleware());

videosEndpoint.post("/upload-url", async (c) => {
	const user = c.get("user");

	// Check daily limit
	const todayCount = await countUserVideoUploadsToday(user.userId);
	if (todayCount >= DAILY_VIDEO_LIMIT) {
		return c.json({ error: "Osiągnięto dzienny limit wideo (5)" }, 429);
	}

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

videosEndpoint.get("/:uid/thumbnail", async (c) => {
	const uid = c.req.param("uid");

	// Redirect to Cloudflare Stream thumbnail
	const thumbnailUrl = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;

	return c.redirect(thumbnailUrl);
});

videosEndpoint.get("/:uid/stream", async (c) => {
	const uid = c.req.param("uid");

	// Stream video from Cloudflare Stream
	const videoUrl = `https://customer-${c.env.CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${uid}/manifest/video.m3u8`;

	// Fetch from Cloudflare Stream and proxy to client
	const response = await fetch(videoUrl);
	if (!response.ok) {
		return c.json({ error: "Failed to fetch video" }, 500);
	}

	// Stream the response
	return new Response(response.body, {
		headers: {
			"Content-Type": response.headers.get("Content-Type") || "application/vnd.apple.mpegurl",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
});

videosEndpoint.delete("/:id", async (c) => {
	const videoId = c.req.param("id");
	const user = c.get("user");

	// Get the video with its post
	const result = await getVideoById(videoId);
	if (!result) {
		return c.json({ error: "Video not found" }, 404);
	}

	const { video, post } = result;

	// Check authorization
	const actor = { userId: user.userId, role: user.role };
	const target = { authorId: post.authorId };
	if (!canDeletePost(actor, target)) {
		return c.json({ error: "Forbidden" }, 403);
	}

	// Delete from database
	const deletedVideo = await deletePostVideo(post.id, videoId);
	if (!deletedVideo) {
		return c.json({ error: "Failed to delete video" }, 500);
	}

	// Delete from Cloudflare Stream
	try {
		await deleteStreamVideo({
			accountId: c.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: c.env.CLOUDFLARE_STREAM_API_TOKEN,
			uid: video.cfStreamUid,
		});
	} catch (_error) {
		// Continue anyway - video is deleted from DB
	}

	return c.json({ data: deletedVideo });
});

export default videosEndpoint;
