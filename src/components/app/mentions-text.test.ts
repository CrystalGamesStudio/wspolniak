// SPDX-License-Identifier: AGPL-3.0-or-later
import { detectMentionQuery, highlightMentions, insertMention } from "./mentions-text";

describe("detectMentionQuery", () => {
	it("detects the query right after @ at the start of text", () => {
		expect(detectMentionQuery("Hej @An", 7)).toEqual({ startIndex: 4, query: "An" });
	});

	it("detects an empty query when caret is right after @", () => {
		expect(detectMentionQuery("Hej @", 5)).toEqual({ startIndex: 4, query: "" });
	});

	it("returns null when @ is not preceded by whitespace (email-like text)", () => {
		expect(detectMentionQuery("a@b", 3)).toBeNull();
	});

	it("returns null when the query contains whitespace (mention broken by space)", () => {
		expect(detectMentionQuery("@An Bas", 7)).toBeNull();
	});

	it("returns null when there is no @ before the caret", () => {
		expect(detectMentionQuery("Hej everyone", 12)).toBeNull();
	});

	it("uses the last @ when multiple are present", () => {
		expect(detectMentionQuery("@An @B", 6)).toEqual({ startIndex: 4, query: "B" });
	});

	it("returns null when caret moved before the @", () => {
		// "@An" with caret at 0 — nothing before caret
		expect(detectMentionQuery("@An", 0)).toBeNull();
	});
});

describe("insertMention", () => {
	it("replaces @query with @name and a trailing space, caret after the space", () => {
		const result = insertMention("Hej @An!", { startIndex: 4, query: "An" }, "Ania");
		expect(result.text).toBe("Hej @Ania !");
		expect(result.caret).toBe(10);
	});

	it("inserts at end of text when mention is the last token", () => {
		const result = insertMention("Hej @An", { startIndex: 4, query: "An" }, "Andrzej");
		expect(result.text).toBe("Hej @Andrzej ");
		expect(result.caret).toBe(13);
	});

	it("preserves text after the replaced query", () => {
		const result = insertMention("@An i reszta", { startIndex: 0, query: "An" }, "Ania");
		expect(result.text).toBe("@Ania  i reszta");
	});
});

describe("highlightMentions", () => {
	it("returns plain text as a single non-mention segment", () => {
		expect(highlightMentions("Hej wszystkim")).toEqual([
			{ text: "Hej wszystkim", isMention: false },
		]);
	});

	it("splits out a @mention in the middle", () => {
		expect(highlightMentions("Hej @Ania!")).toEqual([
			{ text: "Hej ", isMention: false },
			{ text: "@Ania", isMention: true },
			{ text: "!", isMention: false },
		]);
	});

	it("handles a mention at the start", () => {
		expect(highlightMentions("@Ania co tam")).toEqual([
			{ text: "@Ania", isMention: true },
			{ text: " co tam", isMention: false },
		]);
	});

	it("handles multiple mentions", () => {
		expect(highlightMentions("@Ania i @Andrzej")).toEqual([
			{ text: "@Ania", isMention: true },
			{ text: " i ", isMention: false },
			{ text: "@Andrzej", isMention: true },
		]);
	});

	it("returns empty array for empty string", () => {
		expect(highlightMentions("")).toEqual([]);
	});
});
