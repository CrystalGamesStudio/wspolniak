// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import type { ReactionType } from "@/db/post-reactions/table";
import { reactionTypes } from "@/db/post-reactions/table";

const reactionEmojis: Record<ReactionType, string> = {
	heart: "❤️",
	thumbs_up: "👍",
	thumbs_down: "👎",
	laugh: "😂",
	emphasize: "‼️",
	question: "❓",
};

interface ReactionButtonProps {
	postId: string;
	currentUserId: string;
}

async function fetchReactionCounts(postId: string): Promise<Record<string, number>> {
	const res = await fetch(`/api/app/posts/${postId}/reactions`);
	if (!res.ok) throw new Error("Failed to fetch reactions");
	const json = (await res.json()) as { data: Record<string, number> };
	return json.data;
}

async function fetchMyReaction(postId: string): Promise<{ reactionType: ReactionType } | null> {
	const res = await fetch(`/api/app/posts/${postId}/my-reaction`);
	if (!res.ok) throw new Error("Failed to fetch reaction");
	const json = (await res.json()) as { data: { reactionType: ReactionType } | null };
	return json.data;
}

async function setReaction(postId: string, reactionType: ReactionType) {
	const res = await fetch(`/api/app/posts/${postId}/reactions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ reactionType }),
	});
	if (!res.ok) throw new Error("Failed to set reaction");
	return res.json();
}

function useIsMobile() {
	const [isMobile, _setIsMobile] = useState(() => {
		if (typeof window === "undefined" || !window.matchMedia) return false;
		return window.matchMedia("(max-width: 639px)").matches;
	});

	return isMobile;
}

export function ReactionButton({ postId }: ReactionButtonProps) {
	const queryClient = useQueryClient();
	const isMobile = useIsMobile();
	const [sheetOpen, setSheetOpen] = useState(false);

	const { data: counts = {} } = useQuery({
		queryKey: ["post-reactions", postId],
		queryFn: () => fetchReactionCounts(postId),
	});

	const { data: myReaction } = useQuery({
		queryKey: ["my-reaction", postId],
		queryFn: () => fetchMyReaction(postId),
	});

	const mutation = useMutation({
		mutationFn: (reactionType: ReactionType) => setReaction(postId, reactionType),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["post-reactions", postId] }),
				queryClient.invalidateQueries({ queryKey: ["my-reaction", postId] }),
			]);
		},
	});

	const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
	const emoji = myReaction ? reactionEmojis[myReaction.reactionType] : "😊";

	const handleSelect = (type: ReactionType) => {
		mutation.mutate(type);
		setSheetOpen(false);
	};

	if (isMobile) {
		return (
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetTrigger asChild>
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-2 sm:py-1"
					>
						{emoji} {total}
					</button>
				</SheetTrigger>
				<SheetContent side="bottom" className="rounded-t-2xl">
					<SheetTitle className="text-foreground text-center text-sm">React</SheetTitle>
					<SheetDescription className="sr-only">Choose a reaction</SheetDescription>
					<div className="grid grid-cols-3 gap-4 p-4">
						{reactionTypes.map((type) => (
							<button
								key={type}
								type="button"
								className={`min-h-[44px] min-w-[44px] rounded-lg p-3 text-2xl transition-colors hover:bg-accent${myReaction?.reactionType === type ? " bg-accent" : ""}`}
								onClick={() => handleSelect(type)}
							>
								{reactionEmojis[type]}
							</button>
						))}
					</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-2 sm:py-1"
				>
					{emoji} {total}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{reactionTypes.map((type) => (
					<DropdownMenuItem key={type} onSelect={() => mutation.mutate(type)}>
						{reactionEmojis[type]}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
