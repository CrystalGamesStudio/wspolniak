// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ReactionButton } from "./reaction-button";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function mockFetch() {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockImplementation((url: string) => {
			if (url.includes("/my-reaction")) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
		}),
	);
}

function mockMobile() {
	Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches: query.includes("639") || query.includes("max-width"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	);
}

function mockDesktop() {
	Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation(() => ({
			matches: false,
			media: "",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	);
}

describe("ReactionButton (desktop)", () => {
	beforeEach(() => {
		mockDesktop();
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders total reaction count", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((url: string) => {
				if (url.includes("/reactions") && !url.includes("/my-reaction")) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve({ data: { heart: 3, thumbs_up: 2 } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: null }),
				});
			}),
		);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });
		await screen.findByText(/5/);

		expect(screen.getByText(/5/)).toBeDefined();
	});

	it("highlights user's current reaction emoji", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((url: string) => {
				if (url.includes("/my-reaction")) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve({ data: { reactionType: "heart" } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: { heart: 1 } }),
				});
			}),
		);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const button = await screen.findByRole("button", { name: /❤️/ });
		expect(button).toBeDefined();
	});

	it("opens picker and sends mutation on emoji click", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: { reactionType: "thumbs_up" } }),
				});
			}
			if (url.includes("/my-reaction")) {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: null }),
				});
			}
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ data: {} }),
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		const thumbsUp = await screen.findByRole("menuitem", { name: /👍/ });
		await userEvent.click(thumbsUp);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/app/posts/post-1/reactions",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ reactionType: "thumbs_up" }),
			}),
		);
	});
});

describe("ReactionButton (mobile)", () => {
	beforeEach(() => {
		mockMobile();
		mockFetch();
	});
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("opens bottom sheet instead of dropdown on mobile", async () => {
		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		expect(await screen.findByRole("dialog")).toBeDefined();
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("shows all 6 emojis in touch-friendly grid inside sheet", async () => {
		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		const dialog = await screen.findByRole("dialog");
		const grid = dialog.querySelector("[class*='grid-cols-3']");
		const buttons = grid?.querySelectorAll("button");
		expect(buttons).toHaveLength(6);

		const labels = Array.from(buttons ?? []).map((b) => b.textContent);
		expect(labels).toEqual(["❤️", "👍", "👎", "😂", "‼️", "❓"]);

		for (const btn of Array.from(buttons ?? [])) {
			expect(btn.className).toContain("min-w-[44px]");
			expect(btn.className).toContain("min-h-[44px]");
		}
	});

	it("highlights current user reaction in mobile sheet", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation((url: string) => {
				if (url.includes("/my-reaction")) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve({ data: { reactionType: "heart" } }),
					});
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: { heart: 1 } }),
				});
			}),
		);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		const dialog = await screen.findByRole("dialog");
		const grid = dialog.querySelector("[class*='grid-cols-3']");
		const buttons = grid?.querySelectorAll("button");

		const heartBtn = Array.from(buttons ?? []).find((b) => b.textContent === "❤️");
		const thumbsBtn = Array.from(buttons ?? []).find((b) => b.textContent === "👍");

		const heartClasses = heartBtn?.className.split(" ") ?? [];
		const thumbsClasses = thumbsBtn?.className.split(" ") ?? [];
		expect(heartClasses).toContain("bg-accent");
		expect(thumbsClasses).not.toContain("bg-accent");
	});

	it("fires mutation and closes sheet on emoji tap", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ data: { reactionType: "thumbs_up" } }),
				});
			}
			if (url.includes("/my-reaction")) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
		});
		vi.stubGlobal("fetch", fetchMock);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		const dialog = await screen.findByRole("dialog");
		const grid = dialog.querySelector("[class*='grid-cols-3']");
		const thumbsBtn = Array.from(grid?.querySelectorAll("button") ?? []).find(
			(b) => b.textContent === "👍",
		);
		await userEvent.click(thumbsBtn!);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/app/posts/post-1/reactions",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ reactionType: "thumbs_up" }),
			}),
		);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("dismisses sheet without mutation when overlay is clicked", async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes("/my-reaction")) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
		});
		vi.stubGlobal("fetch", fetchMock);

		render(<ReactionButton postId="post-1" currentUserId="u1" />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button");
		await userEvent.click(trigger);

		await screen.findByRole("dialog");

		const overlay = document.querySelector("[data-slot='sheet-overlay']");
		await userEvent.click(overlay!);

		expect(screen.queryByRole("dialog")).toBeNull();

		const postCalls = fetchMock.mock.calls.filter(
			(c) => (c[1] as RequestInit | undefined)?.method === "POST",
		);
		expect(postCalls).toHaveLength(0);
	});
});
