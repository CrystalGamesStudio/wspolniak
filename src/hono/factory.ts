// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Context } from "hono";
import { Hono } from "hono";
import type { SessionPayload } from "@/db/identity/session";

type AppEnv = {
	Bindings: Env;
	Variables: { user: SessionPayload };
};

export const createHono = () => new Hono<AppEnv>();

export function getOrigin(c: Context<AppEnv>): string {
	if (c.env?.APP_URL) return c.env.APP_URL;
	const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "");
	const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? new URL(c.req.url).host;
	return `${proto}://${host}`;
}
