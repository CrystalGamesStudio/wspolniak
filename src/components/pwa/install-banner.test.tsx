// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallBanner } from "./install-banner";

const STORAGE_KEY = "install-banner-dismissed";

function mockLocalStorage() {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => store.set(key, value)),
		removeItem: vi.fn((key: string) => store.delete(key)),
	} as unknown as Storage;
}

describe("InstallBanner", () => {
	let storage: Storage;

	beforeEach(() => {
		storage = mockLocalStorage();
		vi.stubGlobal("localStorage", storage);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders banner when canInstall is true and not dismissed", () => {
		render(<InstallBanner canInstall promptInstall={vi.fn()} />);
		expect(screen.getByText("Zainstaluj aplikację Wspólniak")).toBeDefined();
	});

	it("does not render when canInstall is false", () => {
		render(<InstallBanner canInstall={false} promptInstall={vi.fn()} />);
		expect(screen.queryByText("Zainstaluj aplikację Wspólniak")).toBeNull();
	});

	it("does not render when previously dismissed", () => {
		storage.setItem(STORAGE_KEY, "true");
		render(<InstallBanner canInstall promptInstall={vi.fn()} />);
		expect(screen.queryByText("Zainstaluj aplikację Wspólniak")).toBeNull();
	});

	it("hides banner and persists dismissal on close", async () => {
		const user = userEvent.setup();
		render(<InstallBanner canInstall promptInstall={vi.fn()} />);

		const closeButton = screen.getByRole("button", { name: /nie teraz/i });
		await user.click(closeButton);

		expect(screen.queryByText("Zainstaluj aplikację Wspólniak")).toBeNull();
		expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
	});

	it("calls promptInstall when install button is clicked", async () => {
		const user = userEvent.setup();
		const promptInstall = vi.fn();
		render(<InstallBanner canInstall promptInstall={promptInstall} />);

		const installButton = screen.getByRole("button", { name: /instaluj/i });
		await user.click(installButton);

		expect(promptInstall).toHaveBeenCalledTimes(1);
	});
});
