// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download } from "lucide-react";
import { PostActions } from "@/components/app/post-actions";
import { getImageUrl } from "@/images/client";
import { downloadImage } from "@/lib/download-image";

interface PostImage {
	id: string;
	postId: string;
	cfImageId: string;
	displayOrder: number;
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
}

interface PostViewProps {
	post: PostData;
	imageAccountHash: string;
	currentUserId?: string;
	currentUserRole?: string;
	onDeleted?: () => void;
}

export function PostView({
	post,
	imageAccountHash,
	currentUserId,
	currentUserRole,
	onDeleted,
}: PostViewProps) {
	const canManage = currentUserId === post.authorId || currentUserRole === "admin";

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
					<div className="ml-auto">
						<PostActions postId={post.id} description={post.description} onDeleted={onDeleted} />
					</div>
				)}
			</div>

			{post.description && (
				<p className="whitespace-pre-wrap break-words text-foreground">{post.description}</p>
			)}

			<div className="space-y-2">
				{post.images.map((image) => {
					const src = getImageUrl({
						accountHash: imageAccountHash,
						cfImageId: image.cfImageId,
						variant: "public",
					});
					return (
						<div key={image.id} className="group relative">
							<img
								src={src}
								alt={`Zdjęcie ${image.displayOrder + 1}`}
								className="w-full rounded-lg"
								loading="lazy"
							/>
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
		</article>
	);
}
