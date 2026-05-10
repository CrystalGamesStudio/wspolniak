// SPDX-License-Identifier: AGPL-3.0-or-later
import type { QueryClient } from "@tanstack/react-query";
import type { CommentWithAuthor } from "./comment-section";

interface OptimisticContext {
	previousComments: CommentWithAuthor[] | undefined;
}

export function optimisticCommentMutation(
	queryClient: QueryClient,
	postId: string,
	currentUser: { id: string; name: string },
) {
	const queryKey = ["comments", postId] as const;

	return {
		onMutate: async (body: string): Promise<OptimisticContext> => {
			await queryClient.cancelQueries({ queryKey });
			const previousComments = queryClient.getQueryData<CommentWithAuthor[]>(queryKey);

			const optimisticComment: CommentWithAuthor = {
				id: `optimistic-${Date.now()}`,
				postId,
				authorId: currentUser.id,
				body,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				author: { id: currentUser.id, name: currentUser.name },
			};

			queryClient.setQueryData<CommentWithAuthor[]>(queryKey, (old = []) => [
				...old,
				optimisticComment,
			]);

			return { previousComments };
		},
		onError: (_error: Error, _body: string, context: OptimisticContext | undefined) => {
			if (context?.previousComments) {
				queryClient.setQueryData(queryKey, context.previousComments);
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["comments", postId] });
			await queryClient.invalidateQueries({ queryKey: ["posts"] });
		},
	};
}
