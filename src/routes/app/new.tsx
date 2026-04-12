import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NewPostForm } from "@/components/app/new-post-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

async function uploadFile(file: File): Promise<string> {
	const urlRes = await fetch("/api/app/images/upload-url", { method: "POST" });
	if (!urlRes.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
	const { data } = (await urlRes.json()) as { data: { cfImageId: string; uploadURL: string } };

	const form = new FormData();
	form.append("file", file);
	const uploadRes = await fetch(data.uploadURL, { method: "POST", body: form });
	if (!uploadRes.ok) throw new Error(`Upload nie powiódł się dla: ${file.name}`);

	return data.cfImageId;
}

async function createPost(input: { description: string; files: File[] }) {
	const cfImageIds = await Promise.all(input.files.map(uploadFile));

	const res = await fetch("/api/app/posts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			description: input.description || null,
			cfImageIds,
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

	const mutation = useMutation({
		mutationFn: createPost,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["posts"] });
			navigate({ to: "/app" });
		},
	});

	return (
		<div className="mx-auto max-w-lg bg-background px-4 py-6">
			<h1 className="mb-6 text-2xl font-bold text-foreground">Nowy post</h1>

			{mutation.isError && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{mutation.error.message}</AlertDescription>
				</Alert>
			)}

			<NewPostForm onSubmit={(data) => mutation.mutate(data)} isSubmitting={mutation.isPending} />
		</div>
	);
}
