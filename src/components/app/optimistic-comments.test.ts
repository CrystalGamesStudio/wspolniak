// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CommentWithAuthor } from "./comment-section";
import { optimisticCommentMutation } from "./optimistic-comments";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: { queries: { retry: false } },
	} as QueryClientConfig);
}

const postId = "post-1";
const currentUser = { id: "user-1", name: "Test User" };
const existingComment: CommentWithAuthor = {
	id: "comment-1",
	postId,
	authorId: "user-2",
	body: "Existing comment",
	parentId: null,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	author: { id: "user-2", name: "Other User" },
	replies: [],
};

describe("optimisticCommentMutation", () => {
	const consoleError = console.error;
	beforeAll(() => {
		console.error = vi.fn();
	});
	afterAll(() => {
		console.error = consoleError;
	});

	it("adds optimistic comment to cache on mutate", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(["comments", postId], [existingComment]);

		const mutation = optimisticCommentMutation(queryClient, postId, currentUser);
		const context = await mutation.onMutate?.("New comment");

		const cache = queryClient.getQueryData<CommentWithAuthor[]>(["comments", postId]);
		expect(cache).toHaveLength(2);
		const optimistic = cache?.[1];
		expect(optimistic?.body).toBe("New comment");
		expect(optimistic?.author.name).toBe("Test User");
		expect(optimistic?.id).toMatch(/^optimistic-/);

		if (context?.previousComments) {
			queryClient.setQueryData(["comments", postId], context.previousComments);
		}
	});

	it("restores previous cache on error", async () => {
		const queryClient = createTestQueryClient();
		queryClient.setQueryData(["comments", postId], [existingComment]);

		const mutation = optimisticCommentMutation(queryClient, postId, currentUser);
		const context = await mutation.onMutate?.("New comment");

		await mutation.onError?.(new Error("Network error"), "New comment", context);

		const cache = queryClient.getQueryData<CommentWithAuthor[]>(["comments", postId]);
		expect(cache).toEqual([existingComment]);
	});

	it("invalidates queries on success", async () => {
		const queryClient = createTestQueryClient();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const mutation = optimisticCommentMutation(queryClient, postId, currentUser);
		await mutation.onSuccess();

		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["comments", postId] });
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["posts"] });
	});
});
