// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { reorder } from "./reorder";

describe("reorder", () => {
	it("moves item from lower index to higher index", () => {
		expect(reorder(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
	});

	it("moves item from higher index to lower index", () => {
		expect(reorder(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
	});

	it("returns same array when indices are equal", () => {
		expect(reorder(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
	});

	it("handles two-element swap", () => {
		expect(reorder(["a", "b"], 0, 1)).toEqual(["b", "a"]);
	});

	it("handles single-element array", () => {
		expect(reorder(["a"], 0, 0)).toEqual(["a"]);
	});
});
