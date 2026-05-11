// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ReactionButton } from "./reaction-button";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

describe("ReactionButton", () => {
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
