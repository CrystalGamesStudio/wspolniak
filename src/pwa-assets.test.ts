// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const publicDir = resolve(import.meta.dirname ?? process.cwd(), "../public");

describe("PWA assets", () => {
	const requiredIcons = ["logo192.png", "logo512.png", "apple-touch-icon.png", "favicon.ico"];

	for (const icon of requiredIcons) {
		it(`${icon} exists in public/`, () => {
			expect(existsSync(resolve(publicDir, icon))).toBe(true);
		});
	}

	it("sw.js exists in public/ (registered by PwaShell as /sw.js)", () => {
		expect(existsSync(resolve(publicDir, "sw.js"))).toBe(true);
	});

	it("manifest.webmanifest exists in public/", () => {
		expect(existsSync(resolve(publicDir, "manifest.webmanifest"))).toBe(true);
	});
});
