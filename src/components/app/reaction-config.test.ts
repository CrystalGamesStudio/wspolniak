// SPDX-License-Identifier: AGPL-3.0-or-later
import { REACTION_CONFIG, REACTION_ORDER } from "./reaction-config";

describe("REACTION_CONFIG", () => {
	it("maps each reaction type to a distinct color", () => {
		expect(REACTION_CONFIG.heart.color).toBe("#e42324");
		expect(REACTION_CONFIG.laugh.color).toBe("#0070e1");
		expect(REACTION_CONFIG.flame.color).toBe("#e47600");
	});

	it("exposes an icon and aria label for each type", () => {
		for (const type of REACTION_ORDER) {
			const entry = REACTION_CONFIG[type];
			expect(entry.Icon).toBeDefined();
			expect(entry.label.length).toBeGreaterThan(0);
		}
	});

	it("fills heart and flame but keeps laugh as outline", () => {
		expect(REACTION_CONFIG.heart.filled).toBe(true);
		expect(REACTION_CONFIG.flame.filled).toBe(true);
		expect(REACTION_CONFIG.laugh.filled).toBe(false);
	});
});
