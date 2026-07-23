// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Context } from "hono";
import {
	buildAuthorizationUrl,
	createState,
	encryptRefreshToken,
	exchangeCodeForTokens,
	fetchOwnChannel,
	importEncryptionKey,
	verifyState,
	type YoutubeConfig,
} from "@/core/youtube";
import { clearYoutubeConnection, getYoutubeConnection, setYoutubeConnection } from "@/db/instance";
import { createHono, getOrigin } from "@/hono/factory";
import { adminMiddleware } from "@/hono/middleware/admin";
import { authMiddleware } from "@/hono/middleware/auth";

const videoEndpoint = createHono();

// Auth: every video route requires a session; oauth + connection are admin-only.
// (Upload routes added in F2 will be member-authenticated.)
videoEndpoint.use("*", authMiddleware());
videoEndpoint.use("/oauth/*", adminMiddleware());
videoEndpoint.use("/connection", adminMiddleware());

/** Derives the YouTube config + raw encryption key from env, or null if unset. */
function youtubeEnv(c: Context): { config: YoutubeConfig; encryptionKeyRaw: string } | null {
	const origin = c.env.APP_URL;
	const clientId = c.env.YOUTUBE_CLIENT_ID;
	const clientSecret = c.env.YOUTUBE_CLIENT_SECRET;
	const encryptionKeyRaw = c.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
	if (!origin || !clientId || !clientSecret || !encryptionKeyRaw) {
		return null;
	}
	return {
		encryptionKeyRaw,
		config: {
			clientId,
			clientSecret,
			redirectUri: c.env.YOUTUBE_REDIRECT_URI ?? `${origin}/api/video/oauth/callback`,
			// SESSION_SECRET already signs session cookies; reuse it to sign the OAuth
			// state (CSRF). Token encryption uses YOUTUBE_TOKEN_ENCRYPTION_KEY separately.
			stateSecret: c.env.SESSION_SECRET,
		},
	};
}

// GET /api/video/oauth/start — redirect the admin to Google's consent screen.
videoEndpoint.get("/oauth/start", async (c) => {
	const env = youtubeEnv(c);
	if (!env) return c.json({ error: "YouTube nie jest skonfigurowane" }, 503);

	const admin = c.get("user");
	const state = await createState(admin.userId, env.config);
	return c.redirect(buildAuthorizationUrl(state, env.config));
});

// GET /api/video/oauth/callback — Google redirects back here with ?code&state.
videoEndpoint.get("/oauth/callback", async (c) => {
	const env = youtubeEnv(c);
	if (!env) return c.json({ error: "YouTube nie jest skonfigurowane" }, 503);

	if (c.req.query("error")) {
		return c.redirect(`${getOrigin(c)}/app/admin?youtube=error`);
	}

	const code = c.req.query("code");
	const state = c.req.query("state");
	if (!code || !state) {
		return c.json({ error: "Brak kodu autoryzacji" }, 400);
	}

	const verified = await verifyState(state, env.config);
	if (!verified) {
		return c.json({ error: "Nieprawidłowy stan (CSRF)" }, 400);
	}

	const tokens = await exchangeCodeForTokens(code, env.config);
	const channel = await fetchOwnChannel(tokens.accessToken, env.config);
	const encryptionKey = await importEncryptionKey(env.encryptionKeyRaw);
	const encryptedRefreshToken = await encryptRefreshToken(tokens.refreshToken, encryptionKey);

	await setYoutubeConnection({
		channelId: channel.id,
		channelTitle: channel.title,
		encryptedRefreshToken,
		connectedBy: verified.adminUserId,
	});

	return c.redirect(`${getOrigin(c)}/app/admin?youtube=connected`);
});

// GET /api/video/connection — current connection status (channel name etc.).
videoEndpoint.get("/connection", async (c) => {
	const connection = await getYoutubeConnection();
	return c.json({ data: connection });
});

// DELETE /api/video/connection — disconnect (clears every youtube field).
videoEndpoint.delete("/connection", async (c) => {
	await clearYoutubeConnection();
	return c.json({ data: { ok: true } });
});

export default videoEndpoint;
