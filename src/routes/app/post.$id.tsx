// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CommentSection } from "@/components/app/comment-section";
import { PostView } from "@/components/app/post-view";
import { ThemeToggle } from "@/components/theme";

interface PostResponse {
	data: unknown;
	meta: { imageAccountHash: string };
}

async function fetchPost(id: string): Promise<PostResponse | null> {
	const res = await fetch(`/api/app/posts/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error("Nie udało się pobrać posta");
	return res.json() as Promise<PostResponse>;
}

export const Route = createFileRoute("/app/post/$id")({
	component: PostPage,
});

function PostPage() {
	const { id } = Route.useParams();
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const { data: response, isLoading } = useQuery({
		queryKey: ["posts", id],
		queryFn: () => fetchPost(id),
	});

	// Scroll to comments section when URL hash is #comments
	useEffect(() => {
		if (window.location.hash === "#comments" && !isLoading && response?.data) {
			// Use setTimeout to ensure DOM is fully rendered
			setTimeout(() => {
				const element = document.getElementById("new-comment");
				if (element) {
					element.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}, 300);
		}
	}, [isLoading, response]);

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Ładowanie...</p>
			</div>
		);
	}

	if (!response?.data) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Post nie został znaleziony</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl bg-background px-4 py-6">
			<div className="mb-4 flex items-center justify-between">
				<a href="/app" className="text-sm text-muted-foreground hover:text-foreground">
					&larr; Wróć do feedu
				</a>
				<ThemeToggle size="sm" />
			</div>
			<PostView
				post={response.data as never}
				imageAccountHash={response.meta.imageAccountHash}
				currentUserId={session.userId}
				currentUserRole={session.role}
				onDeleted={() => navigate({ to: "/app" })}
			/>
			<hr className="my-6 border-border" />
			<div id="comments">
				<CommentSection postId={id} currentUserId={session.userId} currentUserRole={session.role} />
			</div>
		</div>
	);
}
