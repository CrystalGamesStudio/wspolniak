// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTableName } from "drizzle-orm";
import { postReactions, reactionTypes } from "./table";

describe("post_reactions table", () => {
	it("exposes exactly the 3 redesigned reaction types", () => {
		expect(reactionTypes).toEqual(["heart", "laugh", "flame"]);
	});

	it("is still named post_reactions", () => {
		expect(getTableName(postReactions)).toBe("post_reactions");
	});
});
