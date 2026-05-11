// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function ReactionButton({ postId }: ReactionButtonProps) {
	const queryClient = useQueryClient();

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
