import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Feed } from "@/components/app/feed";
import { Button } from "@/components/ui/button";

interface FeedResponse {
	data: unknown[];
	meta: { imageAccountHash: string };
}

async function fetchPosts(): Promise<FeedResponse> {
	const res = await fetch("/api/app/posts");
	if (!res.ok) throw new Error("Nie udało się pobrać postów");
	return res.json() as Promise<FeedResponse>;
}

export const Route = createFileRoute("/app/")({
	component: FeedPage,
});

function FeedPage() {
	const { session } = Route.useRouteContext();
	const { data, isLoading } = useQuery({
		queryKey: ["posts"],
		queryFn: fetchPosts,
	});

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Ładowanie...</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl bg-background px-4 py-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold text-foreground">Witaj {session.name}</h1>
				<a href="/app/new">
					<Button>Nowy post</Button>
				</a>
			</div>
			<Feed
				posts={(data?.data ?? []) as never[]}
				imageAccountHash={data?.meta.imageAccountHash ?? ""}
			/>
		</div>
	);
}
