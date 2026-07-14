// SPDX-License-Identifier: AGPL-3.0-or-later
import { polandCalendarDate, polandFiredFor } from "./timezone";

describe("polandCalendarDate", () => {
	it("returns the Polish calendar day for a summer UTC instant (CEST, UTC+2)", () => {
		// 04:00 UTC = 06:00 PL same day
		const date = polandCalendarDate(new Date("2026-07-14T04:00:00Z"));
		expect(date).toEqual({ day: 14, month: 7, year: 2026 });
	});

	it("returns the Polish calendar day for a winter UTC instant (CET, UTC+1)", () => {
		// 04:00 UTC = 05:00 PL same day
		const date = polandCalendarDate(new Date("2026-01-15T04:00:00Z"));
		expect(date).toEqual({ day: 15, month: 1, year: 2026 });
	});

	it("rolls to the next day when UTC instant crosses Polish midnight", () => {
		// 22:00 UTC = 00:00 next day PL (CEST)
		const date = polandCalendarDate(new Date("2026-07-14T22:00:00Z"));
		expect(date).toEqual({ day: 15, month: 7, year: 2026 });
	});
});

describe("polandFiredFor", () => {
	it("normalizes to a stable midnight-UTC timestamp for the Polish calendar day", () => {
		const firedFor = polandFiredFor(new Date("2026-07-14T04:00:00Z"));
		expect(firedFor.getTime()).toBe(Date.UTC(2026, 6, 14));
	});

	it("is identical for any two instants within the same Polish calendar day", () => {
		// 04:00 UTC (06:00 PL) and 10:00 UTC (12:00 PL) — same PL day 14
		const early = polandFiredFor(new Date("2026-07-14T04:00:00Z"));
		const late = polandFiredFor(new Date("2026-07-14T10:00:00Z"));
		expect(early.getTime()).toBe(late.getTime());
	});
});
