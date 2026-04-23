// SPDX-License-Identifier: AGPL-3.0-or-later
// CLI script to regenerate admin magic link
// Usage: pnpm admin:regenerate (uses .dev.vars)
//        pnpm admin:regenerate:production (uses .production.vars)

import { neon } from "@neondatabase/serverless";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { generateToken } from "../src/db/identity/crypto";
import { users } from "../src/db/identity/table";

const host = process.env.DATABASE_HOST;
const username = process.env.DATABASE_USERNAME;
const password = process.env.DATABASE_PASSWORD;

if (!host || !username || !password) {
	console.error("Missing DATABASE_HOST, DATABASE_USERNAME, or DATABASE_PASSWORD");
	process.exit(1);
}

const db = drizzle(neon(`postgres://${username}:${password}@${host}`));

const admins = await db
	.select({ id: users.id, name: users.name })
	.from(users)
	.where(and(eq(users.role, "admin"), isNull(users.deletedAt)));

if (admins.length === 0) {
	console.error("No active admin found in database");
	process.exit(1);
}

const admin = admins[0];
if (!admin) {
	console.error("No active admin found in database");
	process.exit(1);
}
const { plaintext, hash } = await generateToken();

await db.update(users).set({ tokenHash: hash }).where(eq(users.id, admin.id));

console.log("");
console.log(`Admin: ${admin.name} (${admin.id})`);
console.log("");
console.log("New magic link:");
console.log(`  /app/u/${plaintext}`);
console.log("");
console.log("Open this URL on your domain to log in.");
console.log("The previous magic link is now invalid.");
