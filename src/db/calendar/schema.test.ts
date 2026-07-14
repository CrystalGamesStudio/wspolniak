// SPDX-License-Identifier: AGPL-3.0-or-later
import { createCalendarEventSchema, updateCalendarEventSchema } from "./schema";

describe("createCalendarEventSchema", () => {
	describe("valid inputs", () => {
		it("accepts a minimal event (title + day + month)", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "Urodziny Mamy",
				day: 15,
				month: 3,
			});
			expect(result.success).toBe(true);
		});

		it("accepts an event with optional description", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "Rocznica",
				day: 1,
				month: 12,
				description: "Opis wydarzenia",
			});
			expect(result.success).toBe(true);
		});

		it("trims whitespace from title and description", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "  Urodziny  ",
				day: 15,
				month: 3,
				description: "  Opis  ",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("Urodziny");
				expect(result.data.description).toBe("Opis");
			}
		});
	});

	describe("title validation", () => {
		it("rejects empty title", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "",
				day: 15,
				month: 3,
			});
			expect(result.success).toBe(false);
		});

		it("rejects whitespace-only title", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "   ",
				day: 15,
				month: 3,
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing title", () => {
			const result = createCalendarEventSchema.safeParse({
				day: 15,
				month: 3,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("day validation", () => {
		it.each([0, -1, 32, 100, 31.5])("rejects day %d (out of 1–31)", (day) => {
			const result = createCalendarEventSchema.safeParse({
				title: "Test",
				day,
				month: 3,
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-integer day", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "Test",
				day: 15.5,
				month: 3,
			});
			expect(result.success).toBe(false);
		});

		it("accepts day 1 and day 31 (boundaries)", () => {
			expect(createCalendarEventSchema.safeParse({ title: "A", day: 1, month: 1 }).success).toBe(
				true,
			);
			expect(createCalendarEventSchema.safeParse({ title: "B", day: 31, month: 1 }).success).toBe(
				true,
			);
		});
	});

	describe("month validation", () => {
		it.each([0, -1, 13, 100, 6.5])("rejects month %d (out of 1–12)", (month) => {
			const result = createCalendarEventSchema.safeParse({
				title: "Test",
				day: 15,
				month,
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-integer month", () => {
			const result = createCalendarEventSchema.safeParse({
				title: "Test",
				day: 15,
				month: 3.5,
			});
			expect(result.success).toBe(false);
		});

		it("accepts month 1 and month 12 (boundaries)", () => {
			expect(createCalendarEventSchema.safeParse({ title: "A", day: 1, month: 1 }).success).toBe(
				true,
			);
			expect(createCalendarEventSchema.safeParse({ title: "B", day: 1, month: 12 }).success).toBe(
				true,
			);
		});
	});
});

describe("updateCalendarEventSchema", () => {
	it("accepts a partial update with only the title", () => {
		const result = updateCalendarEventSchema.safeParse({ title: "Nowy tytuł" });
		expect(result.success).toBe(true);
	});

	it("accepts a partial update with only day and month", () => {
		const result = updateCalendarEventSchema.safeParse({ day: 1, month: 12 });
		expect(result.success).toBe(true);
	});

	it("accepts an empty object (no-op update)", () => {
		expect(updateCalendarEventSchema.safeParse({}).success).toBe(true);
	});

	it("rejects day out of range when present", () => {
		expect(updateCalendarEventSchema.safeParse({ day: 32 }).success).toBe(false);
	});

	it("rejects month out of range when present", () => {
		expect(updateCalendarEventSchema.safeParse({ month: 13 }).success).toBe(false);
	});

	it("trims the title when present", () => {
		const result = updateCalendarEventSchema.safeParse({ title: "  Nowy  " });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.title).toBe("Nowy");
		}
	});

	it("normalizes an empty description to null", () => {
		const result = updateCalendarEventSchema.safeParse({ description: "   " });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.description).toBeNull();
		}
	});
});
