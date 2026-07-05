// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentItem } from "./comment-item";
import type { CommentWithAuthor } from "./comment-section";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function makeComment(overrides: Partial<CommentWithAuthor> = {}): CommentWithAuthor {
	return {
		id: "c-1",
		postId: "post-1",
		authorId: "u-1",
		body: "Fajne!",
		parentId: null,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		author: { id: "u-1", name: "Tomek" },
		replies: [],
		...overrides,
	};
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("CommentItem", () => {
	it("shows reply counter and Odpowiedz button for a top-level comment with replies", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) }),
		);
		const comment = makeComment({
			replies: [makeComment({ id: "r-1", parentId: "c-1", author: { id: "u-9", name: "Kasia" } })],
		});

		render(
			<CommentItem
				comment={comment}
				postId="post-1"
				currentUserId="u-2"
				currentUserRole="member"
			/>,
			{ wrapper: createWrapper() },
		);

		expect(await screen.findByText(/1 odpowiedź/)).toBeDefined();
		expect(screen.getByRole("button", { name: /Odpowiedz/ })).toBeDefined();
	});

	it("disables reply button when 5 replies are reached", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) }),
		);
		const replies = Array.from({ length: 5 }, (_, i) =>
			makeComment({
				id: `r-${i}`,
				parentId: "c-1",
				author: { id: `u-${i + 10}`, name: `User${i}` },
			}),
		);
		const comment = makeComment({ replies });

		render(
			<CommentItem
				comment={comment}
				postId="post-1"
				currentUserId="u-2"
				currentUserRole="member"
			/>,
			{ wrapper: createWrapper() },
		);

		expect(await screen.findByText(/5 odpowiedzi/)).toBeDefined();
		expect(screen.queryByRole("button", { name: /Odpowiedz/ })).toBeNull();
	});

	it("does not show reply controls for a reply (no reply-on-reply)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) }),
		);
		const reply = makeComment({ id: "r-1", parentId: "c-1" });

		render(
			<CommentItem comment={reply} postId="post-1" currentUserId="u-2" currentUserRole="member" />,
			{ wrapper: createWrapper() },
		);

		expect(screen.queryByRole("button", { name: /Odpowiedz/ })).toBeNull();
		expect(screen.queryByText(/Limit odpowiedzi/)).toBeNull();
	});
});
