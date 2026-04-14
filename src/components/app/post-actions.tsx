// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

interface PostActionsProps {
	postId: string;
	description: string | null;
	onDeleted?: () => void;
}

async function editPost(postId: string, description: string | null) {
	const res = await fetch(`/api/app/posts/${postId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ description }),
	});
	if (res.status === 403) throw new Error("Brak uprawnień do edycji tego posta");
	if (!res.ok) throw new Error("Nie udało się edytować posta");
	return res.json();
}

async function deletePost(postId: string) {
	const res = await fetch(`/api/app/posts/${postId}`, { method: "DELETE" });
	if (res.status === 403) throw new Error("Brak uprawnień do usunięcia tego posta");
	if (!res.ok) throw new Error("Nie udało się usunąć posta");
	return res.json();
}

export function PostActions({ postId, description, onDeleted }: PostActionsProps) {
	const queryClient = useQueryClient();
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [editValue, setEditValue] = useState(description ?? "");

	const editMutation = useMutation({
		mutationFn: (newDescription: string | null) => editPost(postId, newDescription),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["posts", postId] });
			setEditOpen(false);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => deletePost(postId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["posts", postId] });
			setDeleteOpen(false);
			onDeleted?.();
		},
	});

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="size-8">
						<MoreHorizontalIcon className="size-4" />
						<span className="sr-only">Opcje posta</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onSelect={() => {
							setEditValue(description ?? "");
							editMutation.reset();
							setEditOpen(true);
						}}
					>
						<PencilIcon />
						Edytuj opis
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => {
							deleteMutation.reset();
							setDeleteOpen(true);
						}}
					>
						<TrashIcon />
						Usuń post
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edytuj opis</DialogTitle>
					</DialogHeader>
					{editMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{editMutation.error.message}</AlertDescription>
						</Alert>
					)}
					<Textarea
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						maxLength={2000}
						rows={4}
						placeholder="Opis (opcjonalnie)"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)}>
							Anuluj
						</Button>
						<Button
							onClick={() => editMutation.mutate(editValue || null)}
							disabled={editMutation.isPending}
						>
							{editMutation.isPending ? "Zapisywanie..." : "Zapisz"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Usuń post</DialogTitle>
						<DialogDescription>
							Czy na pewno chcesz usunąć ten post? Tej operacji nie można cofnąć.
						</DialogDescription>
					</DialogHeader>
					{deleteMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{deleteMutation.error.message}</AlertDescription>
						</Alert>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Anuluj
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteMutation.mutate()}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Usuwanie..." : "Usuń"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
