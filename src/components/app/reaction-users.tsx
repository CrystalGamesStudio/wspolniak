// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from "@tanstack/react-query";
import { UserSearch } from "lucide-react";
import { REACTION_CONFIG, targetKey, targetUrls } from "@/components/app/reaction-config";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { ReactionTarget, ReactionWithUser } from "@/db/post-reactions/queries";
import type { ReactionType } from "@/db/post-reactions/table";

interface ReactionUsersProps {
	target: ReactionTarget;
}

async function fetchReactionUsers(url: string): Promise<ReactionWithUser[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to fetch reaction users");
	const json = (await res.json()) as { data: ReactionWithUser[] };
	return json.data;
}

export function ReactionUsers({ target }: ReactionUsersProps) {
	const usersKey = [...targetKey(target), "users"] as const;
	const { data: reactions = [], isLoading } = useQuery({
		queryKey: usersKey,
		queryFn: () => fetchReactionUsers(targetUrls(target).users),
	});

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
					<UserSearch className="h-5 w-5" />
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
							{Array.from(grouped.entries()).map(([type, list]) => {
								const config = REACTION_CONFIG[type];
								if (!config) return null; // skip legacy/unknown reaction types (#88)
								const { Icon, color, filled } = config;
								return (
									<div key={type} className="flex flex-wrap items-center gap-2">
										<Icon
											className="size-6"
											style={{ color }}
											fill={filled ? "currentColor" : "none"}
										/>
										{list.map((r) => (
											<span
												key={r.id}
												className="rounded-md bg-muted px-2 py-1 text-sm text-foreground"
											>
												{r.user?.name ?? "Nieznany"}
											</span>
										))}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
