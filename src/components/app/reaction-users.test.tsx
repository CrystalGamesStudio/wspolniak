// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ReactionUsers } from "./reaction-users";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function mockFetchUsers(data: unknown[]) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockImplementation((url: string) => {
			if (url.includes("/reactions/users")) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
		}),
	);
}

describe("ReactionUsers", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("renders button for non-admin member", async () => {
		mockFetchUsers([]);
		render(<ReactionUsers postId="post-1" />, {
			wrapper: createWrapper(),
		});

		expect(await screen.findByRole("button", { name: /pokaż kto zareagował/i })).toBeDefined();
	});

	it("displays grouped users after clicking button", async () => {
		const reactions = [
			{
				id: "r1",
				postId: "post-1",
				userId: "u1",
				reactionType: "heart",
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
				user: { name: "Tomek" },
			},
			{
				id: "r2",
				postId: "post-1",
				userId: "u2",
				reactionType: "thumbs_up",
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
				user: { name: "Ania" },
			},
		];
		mockFetchUsers(reactions);
		render(<ReactionUsers postId="post-1" />, {
			wrapper: createWrapper(),
		});

		const trigger = await screen.findByRole("button", { name: /pokaż kto zareagował/i });
		await userEvent.click(trigger);

		expect(await screen.findByText("Tomek")).toBeDefined();
		expect(await screen.findByText("Ania")).toBeDefined();
	});

	it("shows empty state when no reactions", async () => {
		mockFetchUsers([]);
		render(<ReactionUsers postId="post-1" />, {
			wrapper: createWrapper(),
		});

		const trigger = await screen.findByRole("button", { name: /pokaż kto zareagował/i });
		await userEvent.click(trigger);

		expect(await screen.findByText(/brak reakcji/i)).toBeDefined();
	});
});
