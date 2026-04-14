// SPDX-License-Identifier: AGPL-3.0-or-later
import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { instanceConfig } from "./table";

export async function isSetupCompleted(): Promise<boolean> {
	const rows = await getDb()
		.select()
		.from(instanceConfig)
		.where(eq(instanceConfig.setupCompleted, true));
	return rows.length > 0;
}

export async function completeSetup(familyName: string) {
	const id = crypto.randomUUID();
	const rows = await getDb()
		.insert(instanceConfig)
		.values({ id, familyName, setupCompleted: true })
		.returning();
	const row = rows[0];
	if (!row) throw new Error("completeSetup: insert returned no rows");
	return row;
}
