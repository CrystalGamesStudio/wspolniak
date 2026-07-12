// SPDX-License-Identifier: AGPL-3.0-or-later
import { pointDistance, scaleZoom } from "./use-pinch-zoom";

describe("pointDistance", () => {
	it("returns the Euclidean distance between two points", () => {
		expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});
});

describe("scaleZoom", () => {
	it("scales zoom by the distance ratio (spread = zoom in)", () => {
		const gesture = { startDistance: 100, startZoom: 1 };
		expect(scaleZoom(200, gesture)).toBe(2);
	});

	it("clamps the spread to MAX_ZOOM (4x)", () => {
		const gesture = { startDistance: 100, startZoom: 1 };
		expect(scaleZoom(500, gesture)).toBe(4);
	});

	it("clamps the pinch to MIN_ZOOM (1x)", () => {
		const gesture = { startDistance: 100, startZoom: 1 };
		expect(scaleZoom(25, gesture)).toBe(1);
	});

	it("scales relative to the starting zoom when already zoomed (spread)", () => {
		const gesture = { startDistance: 100, startZoom: 2 };
		expect(scaleZoom(200, gesture)).toBe(4);
	});

	it("scales relative to the starting zoom when already zoomed (pinch in)", () => {
		const gesture = { startDistance: 100, startZoom: 3 };
		expect(scaleZoom(50, gesture)).toBe(1.5);
	});
});
