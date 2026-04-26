// SPDX-License-Identifier: AGPL-3.0-or-later
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Feed } from "@/components/app/feed";
import { FeedbackButton } from "@/components/app/feedback-button";
import { MobileNav } from "@/components/app/mobile-nav";
import { PullToRefresh } from "@/components/app/pull-to-refresh";
import { Button } from "@/components/ui/button";

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
	const loadMoreRef = useRef<HTMLDivElement>(null);

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

	useEffect(() => {
		const el = loadMoreRef.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ rootMargin: "200px" },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Ładowanie...</p>
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
			<div className="mx-auto max-w-2xl bg-background px-4 py-6 pb-20 sm:pb-6">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="text-2xl font-bold text-foreground">Witaj {session.name}</h1>
					<div className="hidden sm:flex sm:items-center sm:gap-2">
						{session.role === "admin" && (
							<a href="/app/admin">
								<Button variant="outline">Rodzina</Button>
							</a>
						)}
						<a href="/app/new">
							<Button>Nowy post</Button>
						</a>
						<FeedbackButton variant="ghost" />
					</div>
				</div>
				<Feed
					posts={allPosts as never[]}
					imageAccountHash={imageAccountHash}
					currentUserId={session.userId}
					currentUserRole={session.role}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					loadMoreRef={loadMoreRef}
				/>
			</div>
			<MobileNav />
		</PullToRefresh>
	);
}
