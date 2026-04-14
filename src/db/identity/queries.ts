// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InferSelectModel } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { generateToken } from "./crypto";
import { users } from "./table";

export type User = InferSelectModel<typeof users>;

interface CreateUserInput {
	name: string;
	role: string;
	tokenHash: string;
}

export async function createUser(input: CreateUserInput) {
	const id = crypto.randomUUID();
	const rows = await getDb()
		.insert(users)
		.values({ id, ...input })
		.returning();
	const row = rows[0];
	if (!row) throw new Error("createUser: insert returned no rows");
	return row;
}

export async function createMember(name: string) {
	const { plaintext, hash } = await generateToken();
	const user = await createUser({ name, role: "member", tokenHash: hash });
	return { user, plaintextToken: plaintext };
}

export async function listActiveMembers(): Promise<User[]> {
	return getDb().select().from(users).where(isNull(users.deletedAt));
}

export async function regenerateMemberToken(userId: string) {
	const { plaintext, hash } = await generateToken();
	await getDb().update(users).set({ tokenHash: hash }).where(eq(users.id, userId));
	return { plaintextToken: plaintext };
}

export async function softDeleteMember(userId: string) {
	await getDb().update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
}

export async function findUserByTokenHash(tokenHash: string): Promise<User | null> {
	const rows = await getDb()
		.select()
		.from(users)
		.where(and(eq(users.tokenHash, tokenHash), isNull(users.deletedAt)));
	return rows[0] ?? null;
}
