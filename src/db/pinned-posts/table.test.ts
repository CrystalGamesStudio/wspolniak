// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTableName } from "drizzle-orm";
import { pinnedPosts } from "./table";

describe("pinned_posts table", () => {
	it("is named pinned_posts", () => {
		expect(getTableName(pinnedPosts)).toBe("pinned_posts");
	});
});
