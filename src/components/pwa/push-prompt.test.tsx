// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushPrompt } from "./push-prompt";

const mockHook = vi.fn();

vi.mock("@/pwa/use-push-subscription", () => ({
	usePushSubscription: () => mockHook(),
}));

function mockLocalStorage(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => store.set(key, value)),
		removeItem: vi.fn((key: string) => store.delete(key)),
		clear: vi.fn(() => store.clear()),
		key: vi.fn(),
		length: 0,
	} as unknown as Storage;
}

describe("PushPrompt", () => {
	let storage: Storage;

	beforeEach(() => {
		storage = mockLocalStorage();
		vi.stubGlobal("localStorage", storage);
		mockHook.mockReturnValue({
			permission: "default",
			isSubscribed: false,
			subscribe: vi.fn(),
			unsubscribe: vi.fn(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		mockHook.mockReset();
	});

	it("renders banner when standalone, permission default, not subscribed", () => {
		render(<PushPrompt isStandalone />);
		expect(screen.getByText("Włącz powiadomienia o nowych zdjęciach")).toBeDefined();
	});

	it("does not render when previously dismissed", () => {
		storage.setItem("push-prompt-dismissed", "true");
		render(<PushPrompt isStandalone />);
		expect(screen.queryByText("Włącz powiadomienia o nowych zdjęciach")).toBeNull();
	});

	it("hides banner and persists dismissal on close", async () => {
		const user = userEvent.setup();
		render(<PushPrompt isStandalone />);

		const closeButton = screen.getByRole("button", { name: /zamknij/i });
		await user.click(closeButton);

		expect(screen.queryByText("Włącz powiadomienia o nowych zdjęciach")).toBeNull();
		expect(storage.setItem).toHaveBeenCalledWith("push-prompt-dismissed", "true");
	});

	it("calls subscribe when Włącz is clicked", async () => {
		const user = userEvent.setup();
		const subscribe = vi.fn();
		mockHook.mockReturnValue({
			permission: "default",
			isSubscribed: false,
			subscribe,
			unsubscribe: vi.fn(),
		});
		render(<PushPrompt isStandalone />);

		const subscribeButton = screen.getByRole("button", { name: /włącz/i });
		await user.click(subscribeButton);

		expect(subscribe).toHaveBeenCalledTimes(1);
	});

	it("does not render when not standalone", () => {
		render(<PushPrompt isStandalone={false} />);
		expect(screen.queryByText("Włącz powiadomienia o nowych zdjęciach")).toBeNull();
	});

	it.each([
		["denied"],
		["unsupported"],
	] as const)("does not render when permission is %s", (permission) => {
		mockHook.mockReturnValue({
			permission,
			isSubscribed: false,
			subscribe: vi.fn(),
			unsubscribe: vi.fn(),
		});
		render(<PushPrompt isStandalone />);
		expect(screen.queryByText("Włącz powiadomienia o nowych zdjęciach")).toBeNull();
	});

	it("does not render when already subscribed", () => {
		mockHook.mockReturnValue({
			permission: "granted",
			isSubscribed: true,
			subscribe: vi.fn(),
			unsubscribe: vi.fn(),
		});
		render(<PushPrompt isStandalone />);
		expect(screen.queryByText("Włącz powiadomienia o nowych zdjęciach")).toBeNull();
	});
});
