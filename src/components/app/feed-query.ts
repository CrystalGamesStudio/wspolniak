// SPDX-License-Identifier: AGPL-3.0-or-later
import type { InfiniteData, QueryClient, UseMutationOptions } from "@tanstack/react-query";

export interface FeedImage {
	id: string;
	postId: string;
	cfImageId: string;
	displayOrder: number;
	createdAt: string;
}

export interface FeedPost {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
	images: FeedImage[];
	commentCount?: number;
	pinned?: boolean;
	pending?: boolean;
}

export interface FeedPage {
	data: FeedPost[];
	meta: {
		nextCursor: { createdAt: string; id: string } | null;
		imageAccountHash: string;
	};
}

/** Klucz infinite query feedu w cache TanStack Query. */
export const feedQueryKey = ["posts"] as const;

export interface OptimisticPostInput {
	description: string | null;
	images: FeedImage[];
}

export interface PostMutationContext {
	previousData?: InfiniteData<FeedPage>;
}

/**
 * Opcje mutacji tworzenia posta z optimistic UI.
 *
 * - `onMutate`: anuluje zapytania w locie, zapamiętuje snapshot cache, wstawia
 *   post-placeholder na górę feedu.
 * - `onError`: przywraca snapshot (rollback) — optimistyczny post znika.
 * - `onSettled`: unieważnia feed po sukcesie, żeby zastąpić placeholder prawdziwym postem.
 *
 * `mutationFn` to jedyna granica sieci (mockowana w testach, realna w route).
 */
export function createPostMutationOptions<TVariables extends OptimisticPostInput>(
	queryClient: QueryClient,
	author: { id: string; name: string },
	mutationFn: (variables: TVariables) => Promise<unknown>,
): UseMutationOptions<unknown, Error, TVariables, PostMutationContext> {
	return {
		mutationFn,
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: feedQueryKey });
			const previousData = queryClient.getQueryData<InfiniteData<FeedPage>>(feedQueryKey);
			const optimistic = buildOptimisticPost({
				author,
				description: variables.description,
				images: variables.images,
			});
			if (previousData) {
				queryClient.setQueryData(feedQueryKey, prependOptimisticPost(previousData, optimistic));
			}
			return { previousData };
		},
		onError: (_error, _variables, onMutateResult) => {
			if (onMutateResult?.previousData) {
				queryClient.setQueryData(feedQueryKey, onMutateResult.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: feedQueryKey });
		},
	};
}

/**
 * Wstawia optimistyczny post na górę pierwszej strony feedu (nie mutuje wejścia).
 * Pozostałe strony, meta pierwszej strony i pageParams pozostają nietknięte.
 * Gdy cache nie ma jeszcze stron — tworzy pierwszą z pustym imageAccountHash.
 */
export function prependOptimisticPost(
	data: InfiniteData<FeedPage>,
	optimistic: FeedPost,
): InfiniteData<FeedPage> {
	if (data.pages.length === 0) {
		return {
			pages: [{ data: [optimistic], meta: { nextCursor: null, imageAccountHash: "" } }],
			pageParams: [...data.pageParams],
		};
	}

	const [firstPage, ...restPages] = data.pages;
	const updatedFirst: FeedPage = {
		data: [optimistic, ...firstPage.data],
		meta: firstPage.meta,
	};

	return {
		pages: [updatedFirst, ...restPages],
		pageParams: [...data.pageParams],
	};
}

/**
 * Buduje post-placeholder z danych formularza — używany w optimistic update
 * zanim serwer potwierdzi utworzenie posta. Oznaczony flagą `pending`.
 */
export function buildOptimisticPost(input: {
	author: { id: string; name: string };
	description: string | null;
	images: FeedImage[];
}): FeedPost {
	const now = new Date().toISOString();
	return {
		id: `optimistic-${crypto.randomUUID()}`,
		authorId: input.author.id,
		description: input.description,
		createdAt: now,
		updatedAt: now,
		author: input.author,
		images: input.images,
		commentCount: 0,
		pinned: false,
		pending: true,
	};
}
