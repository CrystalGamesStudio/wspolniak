// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTableColumns, getTableName } from "drizzle-orm";
import { instanceConfig } from "./table";

describe("instance_config table", () => {
	const columns = getTableColumns(instanceConfig);

	it("is named 'instance_config'", () => {
		expect(getTableName(instanceConfig)).toBe("instance_config");
	});

	it("has all expected columns", () => {
		expect(Object.keys(columns).sort()).toEqual(
			["id", "familyName", "setupCompleted", "createdAt"].sort(),
		);
	});

	it("id is text primary key", () => {
		expect(columns.id.dataType).toBe("string");
		expect(columns.id.primary).toBe(true);
	});

	it("family_name is text not null", () => {
		expect(columns.familyName.dataType).toBe("string");
		expect(columns.familyName.notNull).toBe(true);
	});

	it("setup_completed is boolean not null with default false", () => {
		expect(columns.setupCompleted.dataType).toBe("boolean");
		expect(columns.setupCompleted.notNull).toBe(true);
		expect(columns.setupCompleted.hasDefault).toBe(true);
	});

	it("created_at is timestamp not null with default", () => {
		expect(columns.createdAt.dataType).toBe("date");
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.createdAt.hasDefault).toBe(true);
	});
});
