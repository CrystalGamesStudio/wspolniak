// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { createPostMutationOptions, type FeedImage } from "@/components/app/feed-query";
import type { Mention } from "@/components/app/mention-input";
import { NewPostForm } from "@/components/app/new-post-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { compressImage } from "@/images/compress";

interface CreatePostVariables {
	description: string | null;
	files: File[];
	mentions: Mention[];
	/** Lokalne podglądy zdjęć do optimistycznego posta (puste = tekst pojawia się natychmiast, zdjęcia po confirmie). */
	images: FeedImage[];
}

async function uploadFile(file: File): Promise<string> {
	const urlRes = await fetch("/api/app/images/upload-url", { method: "POST" });
	if (!urlRes.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
	const { data } = (await urlRes.json()) as { data: { cfImageId: string; uploadURL: string } };

	const compressed = await compressImage(file);
	const form = new FormData();
	form.append("file", compressed);
	const uploadRes = await fetch(data.uploadURL, { method: "POST", body: form });
	if (!uploadRes.ok) throw new Error(`Upload nie powiódł się dla: ${file.name}`);

	return data.cfImageId;
}

async function createPost(input: CreatePostVariables): Promise<unknown> {
	const cfImageIds = await Promise.all(input.files.map(uploadFile));

	const res = await fetch("/api/app/posts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			description: input.description || null,
			cfImageIds,
			mentions: input.mentions,
		}),
	});

	if (res.status === 429) {
		throw new Error("Osiągnięto dzienny limit postów (50)");
	}
	if (!res.ok) {
		throw new Error("Nie udało się utworzyć posta");
	}

	return res.json();
}

export const Route = createFileRoute("/app/new")({
	component: NewPostPage,
});

function NewPostPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { session } = Route.useRouteContext();

	const mutation = useMutation(
		createPostMutationOptions(queryClient, { id: session.userId, name: session.name }, createPost),
	);

	return (
		<div className="max-w-2xl bg-background px-4 py-6 pb-50 sm:pb-6">
			<div className="mb-6 flex items-center gap-4">
				<button
					type="button"
					onClick={() => navigate({ to: "/app" })}
					className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					title="Wróć do feeda"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<h1 className="text-2xl font-bold text-foreground">Nowy post</h1>
			</div>

			{mutation.isError && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{mutation.error.message}</AlertDescription>
				</Alert>
			)}

			<NewPostForm
				onSubmit={(data) => {
					mutation.mutate({
						description: data.description || null,
						files: data.files,
						mentions: data.mentions,
						images: [],
					});
					// Optimistic UI: wracamy do feeda natychmiast — post pojawia się na górze z badge "Publikowanie…",
					// upload i create biegną w tle; onSuccess (invalidate) podmieni placeholder na prawdziwy post.
					navigate({ to: "/app" });
				}}
				isSubmitting={mutation.isPending}
			/>
		</div>
	);
}
