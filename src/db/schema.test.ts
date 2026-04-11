import { getTableName } from "drizzle-orm";
import * as schema from "./schema";

describe("db/schema barrel export", () => {
	it("exports users table", () => {
		expect(schema.users).toBeDefined();
		expect(getTableName(schema.users)).toBe("users");
	});

	it("exports instanceConfig table", () => {
		expect(schema.instanceConfig).toBeDefined();
		expect(getTableName(schema.instanceConfig)).toBe("instance_config");
	});

	it("does not export removed clients table", () => {
		expect("clients" in schema).toBe(false);
	});
});
