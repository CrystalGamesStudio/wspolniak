// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { CommentActions } from "@/components/app/comment-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoaderIcon, Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface CommentWithAuthor {
	id: string;
	postId: string;
	authorId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
}

interface CommentSectionProps {
	postId: string;
	currentUserId: string;
	currentUserRole: string;
}

async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
	const res = await fetch(`/api/app/posts/${postId}/comments`);
	if (!res.ok) throw new Error("Nie udało się pobrać komentarzy");
	const json = (await res.json()) as { data: CommentWithAuthor[] };
	return json.data;
}

async function addComment(postId: string, body: string) {
	const res = await fetch(`/api/app/posts/${postId}/comments`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ body }),
	});
	if (!res.ok) {
		const json = (await res.json()) as { error: string };
		throw new Error(json.error || "Nie udało się dodać komentarza");
	}
	return res.json();
}

export function CommentSection({ postId, currentUserId, currentUserRole }: CommentSectionProps) {
	const queryClient = useQueryClient();
	const [newComment, setNewComment] = useState("");

	const { data: comments = [], isLoading } = useQuery({
		queryKey: ["comments", postId],
		queryFn: () => fetchComments(postId),
	});

	const mutation = useMutation({
		mutationFn: (body: string) => addComment(postId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["comments", postId] });
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			setNewComment("");
		},
	});

	return (
		<section className="space-y-4">
			<h2 className="flex items-center gap-2 font-semibold text-foreground">
				<MessageCircleIcon className="size-5" />
				Komentarze ({comments.length})
			</h2>

			<div className="flex items-center justify-center py-4">
				<Spinner loading={isLoading} size={6} />
			</div>

			<div className="space-y-3">
				{comments.map((comment) => {
					const canManage = currentUserId === comment.authorId || currentUserRole === "admin";
					return (
						<div key={comment.id} className="rounded-md border border-border bg-muted/50 p-3">
							<div className="mb-1 flex items-center gap-2">
								<span className="text-sm font-medium text-foreground">{comment.author.name}</span>
								<time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
									{new Date(comment.createdAt).toLocaleDateString("pl-PL", {
										day: "numeric",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</time>
								{canManage && (
									<div className="ml-auto">
										<CommentActions postId={postId} commentId={comment.id} body={comment.body} />
									</div>
								)}
							</div>
							<p className="whitespace-pre-wrap break-words text-sm text-foreground">
								{comment.body}
							</p>
						</div>
					);
				})}
			</div>

			<div id="new-comment" className="space-y-2">
				{mutation.isError && (
					<Alert variant="destructive">
						<AlertDescription>{mutation.error.message}</AlertDescription>
					</Alert>
				)}
				<Textarea
					value={newComment}
					onChange={(e) => setNewComment(e.target.value)}
					placeholder="Napisz komentarz..."
					maxLength={1000}
					rows={2}
				/>
				<div className="flex items-center justify-between">
					<span className="text-xs text-muted-foreground">{newComment.length}/1000</span>
					<Button
						size="sm"
						onClick={() => {
							mutation.reset();
							mutation.mutate(newComment);
						}}
						disabled={mutation.isPending || !newComment.trim()}
					>
						<LoaderIcon loading={mutation.isPending} />
						{mutation.isPending ? "Wysyłanie..." : "Skomentuj"}
					</Button>
				</div>
			</div>
		</section>
	);
}
