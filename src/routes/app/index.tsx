// SPDX-License-Identifier: AGPL-3.0-or-later
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Feed } from "@/components/app/feed";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { Spinner } from "@/components/ui/spinner";

interface FeedPost {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
	images: {
		id: string;
		postId: string;
		cfImageId: string;
		displayOrder: number;
		createdAt: string;
	}[];
	videos: {
		id: string;
		postId: string;
		cfStreamUid: string;
		displayOrder: number;
		processingStatus: "processing" | "ready" | "error";
		createdAt: string;
	}[];
}

interface FeedPage {
	data: FeedPost[];
	meta: {
		nextCursor: { createdAt: string; id: string } | null;
		imageAccountHash: string;
	};
}

async function fetchPosts({ pageParam }: { pageParam?: string }): Promise<FeedPage> {
	const url = pageParam ? `/api/app/posts?cursor=${pageParam}` : "/api/app/posts";
	const res = await fetch(url);
	if (!res.ok) throw new Error("Nie udało się pobrać postów");
	return res.json() as Promise<FeedPage>;
}

export const Route = createFileRoute("/app/")({
	component: FeedPage,
});

function FeedPage() {
	const { session } = Route.useRouteContext();

	const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
		useInfiniteQuery({
			queryKey: ["posts"],
			queryFn: fetchPosts,
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (lastPage) => {
				const cursor = lastPage.meta.nextCursor;
				return cursor ? `${cursor.createdAt}_${cursor.id}` : undefined;
			},
		});

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<Spinner size={8} />
			</div>
		);
	}

	const allPosts = data?.pages.flatMap((page) => page.data) ?? [];
	const imageAccountHash = data?.pages[0]?.meta.imageAccountHash ?? "";

	return (
		<PullToRefresh
			onRefresh={async () => {
				await refetch();
			}}
		>
			<div className="max-w-2xl bg-background px-4 py-6 pb-28 sm:pb-6">
				<h1 className="mb-6 text-2xl font-bold text-foreground">Witaj {session.name}</h1>
				<Feed
					posts={allPosts as never[]}
					imageAccountHash={imageAccountHash}
					currentUserId={session.userId}
					currentUserRole={session.role}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					onLoadMore={() => fetchNextPage()}
				/>
			</div>
		</PullToRefresh>
	);
}
