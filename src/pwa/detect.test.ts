import { isIOSSafari, isStandalone } from "./detect";

describe("isIOSSafari", () => {
	it("returns true for iPhone Safari", () => {
		const ua =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
		expect(isIOSSafari(ua)).toBe(true);
	});

	it("returns true for iPad Safari", () => {
		const ua =
			"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
		expect(isIOSSafari(ua)).toBe(true);
	});

	it("returns false for Chrome on iOS (not real Safari)", () => {
		const ua =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1";
		expect(isIOSSafari(ua)).toBe(false);
	});

	it("returns false for Android Chrome", () => {
		const ua =
			"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
		expect(isIOSSafari(ua)).toBe(false);
	});

	it("returns false for desktop Safari", () => {
		const ua =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
		expect(isIOSSafari(ua)).toBe(false);
	});
});

describe("isStandalone", () => {
	it("returns true when display-mode is standalone", () => {
		const matchMedia = vi.fn().mockReturnValue({ matches: true });
		expect(isStandalone(matchMedia)).toBe(true);
	});

	it("returns false when display-mode is not standalone", () => {
		const matchMedia = vi.fn().mockReturnValue({ matches: false });
		expect(isStandalone(matchMedia)).toBe(false);
	});
});
