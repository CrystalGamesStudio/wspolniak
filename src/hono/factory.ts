// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";
import type { SessionPayload } from "@/db/identity/session";

export type AppEnv = {
	Bindings: Env;
	Variables: { user: SessionPayload };
};

export const createHono = () => new Hono<AppEnv>();
