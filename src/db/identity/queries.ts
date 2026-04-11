import type { InferSelectModel } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/setup";
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

export async function findUserByTokenHash(tokenHash: string): Promise<User | null> {
	const rows = await getDb()
		.select()
		.from(users)
		.where(and(eq(users.tokenHash, tokenHash), isNull(users.deletedAt)));
	return rows[0] ?? null;
}
