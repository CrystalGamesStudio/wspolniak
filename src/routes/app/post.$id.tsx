import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PostView } from "@/components/app/post-view";

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
			<a
				href="/app"
				className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
			>
				&larr; Wróć do feedu
			</a>
			<PostView
				post={response.data as never}
				imageAccountHash={response.meta.imageAccountHash}
				currentUserId={session.userId}
				currentUserRole={session.role}
				onDeleted={() => navigate({ to: "/app" })}
			/>
		</div>
	);
}
