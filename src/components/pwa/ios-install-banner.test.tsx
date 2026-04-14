// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IOSInstallBanner } from "./ios-install-banner";

const STORAGE_KEY = "ios-install-banner-dismissed";

function mockLocalStorage() {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => store.set(key, value)),
		removeItem: vi.fn((key: string) => store.delete(key)),
	} as unknown as Storage;
}

describe("IOSInstallBanner", () => {
	let storage: Storage;

	beforeEach(() => {
		storage = mockLocalStorage();
		vi.stubGlobal("localStorage", storage);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders banner when on iOS Safari and not standalone", () => {
		render(<IOSInstallBanner isIOSSafari isStandalone={false} />);
		expect(screen.getByText("Dodaj do ekranu głównego")).toBeDefined();
	});

	it("does not render when not iOS Safari", () => {
		render(<IOSInstallBanner isIOSSafari={false} isStandalone={false} />);
		expect(screen.queryByText("Dodaj do ekranu głównego")).toBeNull();
	});

	it("does not render when already standalone (installed)", () => {
		render(<IOSInstallBanner isIOSSafari isStandalone />);
		expect(screen.queryByText("Dodaj do ekranu głównego")).toBeNull();
	});

	it("does not render when previously dismissed", () => {
		storage.setItem(STORAGE_KEY, "true");
		render(<IOSInstallBanner isIOSSafari isStandalone={false} />);
		expect(screen.queryByText("Dodaj do ekranu głównego")).toBeNull();
	});

	it("hides banner and persists dismissal on close", async () => {
		const user = userEvent.setup();
		render(<IOSInstallBanner isIOSSafari isStandalone={false} />);

		const closeButton = screen.getByRole("button", { name: /zamknij/i });
		await user.click(closeButton);

		expect(screen.queryByText("Dodaj do ekranu głównego")).toBeNull();
		expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
	});

	it("shows visual instructions for iOS", () => {
		render(<IOSInstallBanner isIOSSafari isStandalone={false} />);
		expect(screen.getByText(/udostępnij/i)).toBeDefined();
	});
});
