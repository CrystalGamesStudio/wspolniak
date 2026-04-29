// SPDX-License-Identifier: AGPL-3.0-or-later
import { ExternalLinkIcon, MessageCircleIcon } from "lucide-react";
import { PostActions } from "@/components/app/post-actions";
import { Spinner } from "@/components/ui/spinner";
import { getImageUrl } from "@/images/client";

interface FeedImage {
	id: string;
	postId: string;
	cfImageId: string;
	displayOrder: number;
	createdAt: string;
}

interface FeedPost {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
	images: FeedImage[];
	commentCount?: number;
}

interface FeedProps {
	posts: FeedPost[];
	imageAccountHash: string;
	currentUserId: string;
	currentUserRole: string;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
	loadMoreRef?: React.RefObject<HTMLDivElement | null>;
}

export function Feed({
	posts,
	imageAccountHash,
	currentUserId,
	currentUserRole,
	hasNextPage,
	isFetchingNextPage,
	loadMoreRef,
}: FeedProps) {
	if (posts.length === 0) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground">Brak postów</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{posts.map((post) => (
				<article key={post.id} className="rounded-lg border border-border bg-card p-4">
					<div className="mb-2 flex items-center gap-2">
						<span className="font-semibold text-foreground">{post.author.name}</span>
						<time className="text-sm text-muted-foreground" dateTime={post.createdAt}>
							{formatRelativeTime(post.createdAt)}
						</time>
						{(post.authorId === currentUserId || currentUserRole === "admin") && (
							<div className="ml-auto">
								<PostActions postId={post.id} description={post.description} />
							</div>
						)}
					</div>

					{post.description && <p className="mb-3 text-foreground">{post.description}</p>}

					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{post.images.map((image) => (
							<a
								key={image.id}
								href={`/app/post/${post.id}`}
								className="overflow-hidden rounded-md"
							>
								<img
									src={getImageUrl({
										accountHash: imageAccountHash,
										cfImageId: image.cfImageId,
										variant: "thumbnail",
									})}
									alt={`Zdjęcie ${image.displayOrder + 1}`}
									className="aspect-square w-full object-cover transition-transform hover:scale-105"
									loading="lazy"
								/>
							</a>
						))}
					</div>

					<div className="mt-3 flex items-center justify-between">
						<a
							href={`/app/post/${post.id}#comments`}
							className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							<MessageCircleIcon className="size-6 sm:size-4" />
							{post.commentCount ?? 0}
						</a>
						<a
							href={`/app/post/${post.id}`}
							className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
							aria-label="Otwórz pełny post"
						>
							<ExternalLinkIcon className="size-6 sm:size-4" />
							<span className="hidden sm:inline">Otwórz pełny post</span>
						</a>
					</div>
				</article>
			))}

			<div ref={loadMoreRef}>
				<div className="flex items-center justify-center py-4">
					<Spinner loading={isFetchingNextPage} size={6} />
				</div>
				{!hasNextPage && posts.length > 0 && !isFetchingNextPage && (
					<p className="py-4 text-center text-muted-foreground">Koniec</p>
				)}
			</div>
		</div>
	);
}

function formatRelativeTime(isoDate: string): string {
	const date = new Date(isoDate);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60_000);

	if (diffMin < 1) return "przed chwilą";
	if (diffMin < 60) return `${diffMin} min temu`;

	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours} godz. temu`;

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays} dn. temu`;

	return date.toLocaleDateString("pl-PL");
}
