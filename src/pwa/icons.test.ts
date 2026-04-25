// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";

type IconSpec = { file: string; size: number };

const ICONS: readonly IconSpec[] = [
	{ file: "apple-touch-icon.png", size: 180 },
	{ file: "logo192.png", size: 192 },
	{ file: "logo512.png", size: 512 },
] as const;

const PUBLIC_DIR = resolve(__dirname, "../../public");
const NEAR_WHITE_THRESHOLD = 240;
const MAX_NEAR_WHITE_RATIO = 0.95;

function loadIcon(file: string): PNG {
	const buf = readFileSync(resolve(PUBLIC_DIR, file));
	return PNG.sync.read(buf);
}

function nearWhiteRatio(png: PNG): number {
	const { data, width, height } = png;
	const total = width * height;
	let nearWhite = 0;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		const a = data[i + 3];
		if (r === undefined || g === undefined || b === undefined || a === undefined) continue;
		const effR = a === 0 ? 255 : r;
		const effG = a === 0 ? 255 : g;
		const effB = a === 0 ? 255 : b;
		if (
			effR >= NEAR_WHITE_THRESHOLD &&
			effG >= NEAR_WHITE_THRESHOLD &&
			effB >= NEAR_WHITE_THRESHOLD
		) {
			nearWhite++;
		}
	}
	return nearWhite / total;
}

function isFullyOpaque(png: PNG): boolean {
	const { data } = png;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] !== 255) return false;
	}
	return true;
}

describe("PWA icons", () => {
	for (const { file, size } of ICONS) {
		describe(file, () => {
			const png = loadIcon(file);

			it(`is ${size}x${size}`, () => {
				expect(png.width).toBe(size);
				expect(png.height).toBe(size);
			});

			it("is fully opaque (alpha = 255 everywhere)", () => {
				expect(isFullyOpaque(png)).toBe(true);
			});

			it("contains a visible logo (not mostly white)", () => {
				expect(nearWhiteRatio(png)).toBeLessThan(MAX_NEAR_WHITE_RATIO);
			});
		});
	}

	describe("manifest.webmanifest", () => {
		const manifest = JSON.parse(
			readFileSync(resolve(PUBLIC_DIR, "manifest.webmanifest"), "utf8"),
		) as { icons: Array<{ src: string; sizes: string; purpose?: string }> };

		it("references logo192 and logo512", () => {
			const sources = manifest.icons.map((i) => i.src);
			expect(sources).toContain("logo192.png");
			expect(sources).toContain("logo512.png");
		});

		it("includes a maskable icon", () => {
			expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
		});
	});
});
