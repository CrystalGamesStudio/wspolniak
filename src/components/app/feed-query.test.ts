// SPDX-License-Identifier: AGPL-3.0-or-later
import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import {
	buildOptimisticPost,
	createPostMutationOptions,
	type FeedImage,
	type FeedPage,
	type FeedPost,
	feedQueryKey,
	type PostMutationContext,
	prependOptimisticPost,
} from "./feed-query";

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
	return {
		id: "post-1",
		authorId: "user-1",
		description: "Wakacje nad morzem",
		createdAt: "2026-07-01T10:00:00.000Z",
		updatedAt: "2026-07-01T10:00:00.000Z",
		author: { id: "user-1", name: "Ania" },
		images: [],
		commentCount: 0,
		pinned: false,
		...overrides,
	};
}

function makeFeedData(posts: FeedPost[]): InfiniteData<FeedPage> {
	return {
		pages: [{ data: posts, meta: { nextCursor: null, imageAccountHash: "hash-abc" } }],
		pageParams: [undefined],
	};
}

describe("prependOptimisticPost", () => {
	it("wstawia optimistyczny post na górę pierwszej strony feedu", () => {
		const existing = makePost({ id: "real-1" });
		const data = makeFeedData([existing]);
		const optimistic = makePost({ id: "opt-1", description: "Nowy", pending: true });

		const result = prependOptimisticPost(data, optimistic);

		expect(result.pages[0]?.data[0]?.id).toBe("opt-1");
		expect(result.pages[0]?.data).toHaveLength(2);
	});

	it("nie mutuje oryginalnego cache'a", () => {
		const existing = makePost({ id: "real-1" });
		const data = makeFeedData([existing]);
		const optimistic = makePost({ id: "opt-1", pending: true });

		prependOptimisticPost(data, optimistic);

		expect(data.pages[0]?.data[0]?.id).toBe("real-1");
		expect(data.pages[0]?.data).toHaveLength(1);
	});

	it("zachowuje kolejne strony i meta pierwszej strony", () => {
		const first = makePost({ id: "real-1" });
		const second = makePost({ id: "real-2" });
		const data: InfiniteData<FeedPage> = {
			pages: [
				{
					data: [first],
					meta: { nextCursor: { createdAt: "x", id: "y" }, imageAccountHash: "hash-abc" },
				},
				{ data: [second], meta: { nextCursor: null, imageAccountHash: "hash-abc" } },
			],
			pageParams: [undefined, "cursor-1"],
		};
		const optimistic = makePost({ id: "opt-1", pending: true });

		const result = prependOptimisticPost(data, optimistic);

		expect(result.pages).toHaveLength(2);
		expect(result.pages[1]?.data[0]?.id).toBe("real-2");
		expect(result.pages[0]?.meta.nextCursor).toEqual({ createdAt: "x", id: "y" });
		expect(result.pageParams).toEqual([undefined, "cursor-1"]);
	});

	it("działa gdy cache jest pusty (brak stron)", () => {
		const data: InfiniteData<FeedPage> = { pages: [], pageParams: [] };
		const optimistic = makePost({ id: "opt-1", pending: true });

		const result = prependOptimisticPost(data, optimistic);

		expect(result.pages[0]?.data[0]?.id).toBe("opt-1");
		expect(result.pages[0]?.meta.imageAccountHash).toBe("");
	});
});

describe("buildOptimisticPost", () => {
	it("buduje post-placeholder z danymi autora i opisem z formularza", () => {
		const post = buildOptimisticPost({
			author: { id: "user-1", name: "Ania" },
			description: "Szybki post",
			images: [],
		});

		expect(post.author).toEqual({ id: "user-1", name: "Ania" });
		expect(post.description).toBe("Szybki post");
		expect(post.authorId).toBe("user-1");
		expect(post.pending).toBe(true);
		expect(post.id).toBeTruthy();
	});

	it("oznacza optimistyczny post flagą pending", () => {
		const post = buildOptimisticPost({
			author: { id: "user-1", name: "Ania" },
			description: null,
			images: [],
		});

		expect(post.pending).toBe(true);
	});

	it("przenosi lokalne podglądy zdjęć do optimistycznego posta", () => {
		const post = buildOptimisticPost({
			author: { id: "user-1", name: "Ania" },
			description: null,
			images: [{ id: "local-1", postId: "", cfImageId: "", displayOrder: 0, createdAt: "" }],
		});

		expect(post.images).toHaveLength(1);
		expect(post.images[0]?.id).toBe("local-1");
	});
});

function makeQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("createPostMutationOptions — optimistic flow", () => {
	// v5.99.2 callbacki mają dodatkowy parametr wewnętrzny (MutationFunctionContext);
	// w teście wywołujemy handlery przez czysto otypowane stałe, ignorując ten parametr.
	type Vars = { description: string | null; images: FeedImage[] };
	type OnMutate = (variables: Vars) => Promise<PostMutationContext>;
	type OnError = (
		error: Error,
		variables: Vars,
		onMutateResult: PostMutationContext | undefined,
	) => void;

	it("onMutate wstawia optimistyczny post na górę cache z flagą pending", async () => {
		const qc = makeQueryClient();
		qc.setQueryData(feedQueryKey, makeFeedData([makePost({ id: "real-1" })]));
		const mutationFn = vi.fn().mockResolvedValue(makePost({ id: "server-1" }));

		const opts = createPostMutationOptions<Vars>(qc, { id: "user-1", name: "Ania" }, mutationFn);
		const onMutate = opts.onMutate as OnMutate | undefined;

		await onMutate?.({ description: "Nowy", images: [] });

		const cached = qc.getQueryData<InfiniteData<FeedPage>>(feedQueryKey);
		expect(cached?.pages[0]?.data[0]?.pending).toBe(true);
		expect(cached?.pages[0]?.data).toHaveLength(2);
	});

	it("onError wycofuje optimistyczny post — przywraca poprzedni stan cache'a", async () => {
		const qc = makeQueryClient();
		qc.setQueryData(feedQueryKey, makeFeedData([makePost({ id: "real-1" })]));
		const mutationFn = vi.fn().mockResolvedValue(makePost({ id: "server-1" }));

		const opts = createPostMutationOptions<Vars>(qc, { id: "user-1", name: "Ania" }, mutationFn);
		const onMutate = opts.onMutate as OnMutate | undefined;
		const onError = opts.onError as OnError | undefined;

		const result = await onMutate?.({ description: "Nowy", images: [] });
		await onError?.(new Error("upload failed"), { description: "Nowy", images: [] }, result);

		const restored = qc.getQueryData<InfiniteData<FeedPage>>(feedQueryKey);
		expect(restored?.pages[0]?.data[0]?.id).toBe("real-1");
		expect(restored?.pages[0]?.data).toHaveLength(1);
	});

	it("onMutate nie crashuje gdy cache jest jeszcze pusty", async () => {
		const qc = makeQueryClient();
		const mutationFn = vi.fn().mockResolvedValue(makePost({ id: "server-1" }));

		const opts = createPostMutationOptions<Vars>(qc, { id: "user-1", name: "Ania" }, mutationFn);
		const onMutate = opts.onMutate as OnMutate | undefined;

		await expect(onMutate?.({ description: "Pierwszy", images: [] })).resolves.toBeDefined();
	});
});
