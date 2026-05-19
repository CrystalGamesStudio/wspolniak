// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { AdaptiveVideoPlayer } from "@/components/app/adaptive-video-player";
import { ImageLightbox } from "@/components/app/image-lightbox";
import { PostActions } from "@/components/app/post-actions";
import { ReactionButton } from "@/components/app/reaction-button";
import { ReactionUsers } from "@/components/app/reaction-users";
import { getImageUrl } from "@/images/client";
import { downloadImage } from "@/lib/download-image";
import { getStreamThumbnailUrl } from "@/stream/client";

interface PostImage {
	id: string;
	postId: string;
	cfImageId: string;
	displayOrder: number;
	createdAt: string;
}

interface PostVideo {
	id: string;
	postId: string;
	cfStreamUid: string;
	displayOrder: number;
	processingStatus: "processing" | "ready" | "error";
	createdAt: string;
}

interface PostData {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
	images: PostImage[];
	videos?: PostVideo[];
}

interface PostViewProps {
	post: PostData;
	imageAccountHash: string;
	currentUserId?: string;
	currentUserRole?: string;
	onDeleted?: () => void;
	onLightboxChange?: (open: boolean) => void;
}

export function PostView({
	post,
	imageAccountHash,
	currentUserId,
	currentUserRole,
	onDeleted,
	onLightboxChange,
}: PostViewProps) {
	const canManage = currentUserId === post.authorId || currentUserRole === "admin";

	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	useEffect(() => {
		onLightboxChange?.(lightboxIndex !== null);
	}, [lightboxIndex, onLightboxChange]);

	const lightboxImages = post.images.map((img) => ({
		id: img.id,
		src: getImageUrl({
			accountHash: imageAccountHash,
			cfImageId: img.cfImageId,
			variant: "public",
		}),
		alt: `Zdjęcie ${img.displayOrder + 1}`,
	}));

	return (
		<article className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="font-semibold text-foreground">{post.author.name}</span>
				<time className="text-sm text-muted-foreground" dateTime={post.createdAt}>
					{new Date(post.createdAt).toLocaleDateString("pl-PL", {
						day: "numeric",
						month: "long",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					})}
				</time>
				{canManage && (
					<div className="ml-auto flex items-center gap-1">
						<ReactionUsers postId={post.id} currentUserRole={currentUserRole ?? ""} />
						<PostActions postId={post.id} description={post.description} onDeleted={onDeleted} />
					</div>
				)}
			</div>

			{post.description && (
				<p className="whitespace-pre-wrap break-words text-foreground">{post.description}</p>
			)}

			{currentUserId && (
				<div className="flex items-center gap-2">
					<ReactionButton postId={post.id} currentUserId={currentUserId} />
					<ReactionUsers postId={post.id} currentUserRole={currentUserRole ?? ""} />
				</div>
			)}

			{post.videos && post.videos.length > 0 && (
				<div className="space-y-2">
					{post.videos.map((video) => {
						if (video.processingStatus !== "ready") return null;

						return (
							<AdaptiveVideoPlayer
								key={video.id}
								videoUid={video.cfStreamUid}
								thumbnailUrl={getStreamThumbnailUrl(video.cfStreamUid)}
								canAutoplay={false}
							/>
						);
					})}
				</div>
			)}

			<div className="space-y-2">
				{post.images.map((image, index) => {
					const src = getImageUrl({
						accountHash: imageAccountHash,
						cfImageId: image.cfImageId,
						variant: "public",
					});
					return (
						<div key={image.id} className="group relative">
							<button
								type="button"
								onClick={() => setLightboxIndex(index)}
								className="w-full"
								aria-label={`Otwórz zdjęcie ${image.displayOrder + 1}`}
							>
								<img
									src={src}
									alt={`Zdjęcie ${image.displayOrder + 1}`}
									className="w-full rounded-lg"
									loading="lazy"
								/>
							</button>
							<button
								type="button"
								onClick={() => downloadImage(src, `post-${image.displayOrder + 1}.jpg`)}
								className="absolute right-2 bottom-2 rounded-full bg-background/80 p-2 text-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100"
								aria-label={`Pobierz zdjęcie ${image.displayOrder + 1}`}
							>
								<Download className="h-5 w-5" />
							</button>
						</div>
					);
				})}
			</div>

			<ImageLightbox
				images={lightboxImages}
				initialIndex={lightboxIndex ?? 0}
				open={lightboxIndex !== null}
				onClose={() => setLightboxIndex(null)}
			/>
		</article>
	);
}
