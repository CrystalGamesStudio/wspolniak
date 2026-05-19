// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from "@tanstack/react-query";
import { AlignHorizontalDistributeCenterIcon } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactionWithUser } from "@/db/post-reactions/queries";
import type { ReactionType } from "@/db/post-reactions/table";

const reactionEmojis: Record<ReactionType, string> = {
	heart: "❤️",
	thumbs_up: "👍",
	thumbs_down: "👎",
	laugh: "😂",
	emphasize: "‼️",
	question: "❓",
};

interface ReactionUsersProps {
	postId: string;
	currentUserRole: string;
}

async function fetchReactionUsers(postId: string): Promise<ReactionWithUser[]> {
	const res = await fetch(`/api/app/posts/${postId}/reactions/users`);
	if (!res.ok) throw new Error("Failed to fetch reaction users");
	const json = (await res.json()) as { data: ReactionWithUser[] };
	return json.data;
}

export function ReactionUsers({ postId, currentUserRole }: ReactionUsersProps) {
	const isAdmin = currentUserRole === "admin";

	const { data: reactions = [], isLoading } = useQuery({
		queryKey: ["post-reactions-users", postId],
		queryFn: () => fetchReactionUsers(postId),
		enabled: isAdmin,
	});

	if (!isAdmin) {
		return null;
	}

	// Group by reaction type
	const grouped = new Map<ReactionType, ReactionWithUser[]>();
	for (const reaction of reactions) {
		const list = grouped.get(reaction.reactionType) ?? [];
		list.push(reaction);
		grouped.set(reaction.reactionType, list);
	}

	return (
		<Dialog>
			<DialogTrigger asChild>
				<button
					type="button"
					aria-label="Pokaż kto zareagował"
					className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					title="Pokaż kto zareagował"
				>
					<AlignHorizontalDistributeCenterIcon className="h-8 w-8" />
				</button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="text-center">Reakcje</DialogTitle>
					<DialogDescription className="sr-only">
						Lista użytkowników którzy zareagowali
					</DialogDescription>
				</DialogHeader>
				<div>
					{isLoading ? (
						<p className="text-center text-muted-foreground">Ładowanie...</p>
					) : reactions.length === 0 ? (
						<p className="text-center text-muted-foreground">Brak reakcji</p>
					) : (
						<div className="space-y-3">
							{Array.from(grouped.entries()).map(([type, list]) => (
								<div key={type} className="flex flex-wrap items-center gap-2">
									<span className="text-2xl">{reactionEmojis[type]}</span>
									{list.map((r) => (
										<span
											key={r.id}
											className="rounded-md bg-muted px-2 py-1 text-sm text-foreground"
										>
											{r.user?.name ?? "Nieznany"}
										</span>
									))}
								</div>
							))}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
