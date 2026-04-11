import { getDb } from "@/db/setup";
import { users } from "./table";

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
