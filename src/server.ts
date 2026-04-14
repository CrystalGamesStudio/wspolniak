// SPDX-License-Identifier: AGPL-3.0-or-later
// DO NOT DELETE THIS FILE!!!
// Custom CF Workers entry: routes /api/* to Hono, /app/u/* to auth, rest to TanStack Start
import handler from "@tanstack/react-start/server-entry";
import { initDatabase } from "@/db";
import { apiHono } from "@/hono/api";
import authRoute from "@/hono/api/auth";
import { createHono } from "@/hono/factory";

const authHono = createHono();
authHono.route("/app/u", authRoute);

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		initDatabase({
			host: env.DATABASE_HOST,
			username: env.DATABASE_USERNAME,
			password: env.DATABASE_PASSWORD,
		});

		const url = new URL(request.url);

		if (url.pathname.startsWith("/api/")) {
			return apiHono.fetch(request, env, ctx);
		}

		if (url.pathname.startsWith("/app/u/")) {
			return authHono.fetch(request, env, ctx);
		}

		return handler.fetch(request, {
			context: { fromFetch: true },
		});
	},
};
