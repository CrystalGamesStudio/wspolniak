// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { ReactionTarget } from "@/db/post-reactions/queries";
import { ReactionUsers } from "./reaction-users";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function mockFetchUsers(data: unknown[]) {
	return vi.fn().mockImplementation((url: string) => {
		if (url.includes("/reactions/users")) {
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
		}
		return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
	});
}

const POST_TARGET: ReactionTarget = { kind: "post", postId: "post-1" };

describe("ReactionUsers", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("renders button for non-admin member", async () => {
		vi.stubGlobal("fetch", mockFetchUsers([]));
		render(<ReactionUsers target={POST_TARGET} />, { wrapper: createWrapper() });

		expect(await screen.findByRole("button", { name: /pokaż kto zareagował/i })).toBeDefined();
	});

	it("displays grouped users after clicking button", async () => {
		vi.stubGlobal(
			"fetch",
			mockFetchUsers([
				{
					id: "r1",
					postId: "post-1",
					commentId: null,
					userId: "u1",
					reactionType: "heart",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
					user: { name: "Tomek" },
				},
				{
					id: "r2",
					postId: "post-1",
					commentId: null,
					userId: "u2",
					reactionType: "flame",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
					user: { name: "Ania" },
				},
			]),
		);

		render(<ReactionUsers target={POST_TARGET} />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button", { name: /pokaż kto zareagował/i });
		await userEvent.click(trigger);

		expect(await screen.findByText("Tomek")).toBeDefined();
		expect(await screen.findByText("Ania")).toBeDefined();
	});

	it("does not crash on legacy reaction types not in REACTION_CONFIG (#88)", async () => {
		vi.stubGlobal(
			"fetch",
			mockFetchUsers([
				{
					id: "r1",
					postId: "post-1",
					commentId: null,
					userId: "u1",
					// Legacy type from before the heart/laugh/flame redesign (303220e).
					reactionType: "thumbs_up",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
					user: { name: "Legacy" },
				},
				{
					id: "r2",
					postId: "post-1",
					commentId: null,
					userId: "u2",
					reactionType: "heart",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
					user: { name: "Tomek" },
				},
			]),
		);

		render(<ReactionUsers target={POST_TARGET} />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button", { name: /pokaż kto zareagował/i });
		await userEvent.click(trigger);

		// The known reaction still renders; the legacy one is skipped, no crash.
		expect(await screen.findByText("Tomek")).toBeDefined();
		expect(screen.queryByText("Legacy")).toBeNull();
	});

	it("shows empty state when no reactions", async () => {
		vi.stubGlobal("fetch", mockFetchUsers([]));
		render(<ReactionUsers target={POST_TARGET} />, { wrapper: createWrapper() });

		const trigger = await screen.findByRole("button", { name: /pokaż kto zareagował/i });
		await userEvent.click(trigger);

		expect(await screen.findByText(/brak reakcji/i)).toBeDefined();
	});

	it("fetches from the comment endpoint for a comment target", async () => {
		const fetchMock = mockFetchUsers([]);
		vi.stubGlobal("fetch", fetchMock);

		const commentTarget: ReactionTarget = {
			kind: "comment",
			postId: "post-1",
			commentId: "comment-1",
		};
		render(<ReactionUsers target={commentTarget} />, { wrapper: createWrapper() });

		await screen.findByRole("button", { name: /pokaż kto zareagował/i });

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/app/posts/post-1/comments/comment-1/reactions/users",
		);
	});
});
