// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SmilePlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { ReactionDisplay } from "./reaction-display";

const reactionEmojis: Record<ReactionType, string> = {
	heart: "❤️",
	thumbs_up: "👍",
	thumbs_down: "👎",
	laugh: "😂",
	emphasize: "‼️",
	question: "❓",
};

const reactionLabels: Record<ReactionType, string> = {
	heart: "serce",
	thumbs_up: "kciuk w górę",
	thumbs_down: "kciuk w dół",
	laugh: "śmiech",
	emphasize: "wykrzyknik",
	question: "pytanie",
};

interface ReactionButtonProps {
	postId: string;
	currentUserId: string;
}

type Counts = Record<string, number>;
type MyReaction = { reactionType: ReactionType } | null;
interface OptimisticContext {
	previousCounts: Counts | undefined;
	previousMyReaction: MyReaction | undefined;
}

async function fetchReactionCounts(postId: string): Promise<Record<string, number>> {
	const res = await fetch(`/api/app/posts/${postId}/reactions`);
	if (!res.ok) throw new Error("Failed to fetch reactions");
	const json = (await res.json()) as { data: Record<string, number> };
	return json.data;
}

async function fetchMyReaction(postId: string): Promise<MyReaction> {
	const res = await fetch(`/api/app/posts/${postId}/my-reaction`);
	if (!res.ok) throw new Error("Failed to fetch reaction");
	const json = (await res.json()) as { data: MyReaction };
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
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		if (!window.matchMedia) return;
		const mql = window.matchMedia("(max-width: 639px)");
		setIsMobile(mql.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	return isMobile;
}

function applyOptimisticCounts(
	counts: Counts,
	from: ReactionType | undefined,
	to: ReactionType,
): Counts {
	const next = { ...counts };
	if (from && next[from] !== undefined) {
		next[from] = Math.max(0, next[from] - 1);
	}
	next[to] = (next[to] ?? 0) + 1;
	return next;
}

export function ReactionButton({ postId }: ReactionButtonProps) {
	const queryClient = useQueryClient();
	const isMobile = useIsMobile();
	const [sheetOpen, setSheetOpen] = useState(false);

	const countsKey = ["post-reactions", postId] as const;
	const myReactionKey = ["my-reaction", postId] as const;

	const { data: counts = {} } = useQuery({
		queryKey: countsKey,
		queryFn: () => fetchReactionCounts(postId),
	});

	const { data: myReaction } = useQuery({
		queryKey: myReactionKey,
		queryFn: () => fetchMyReaction(postId),
	});

	const mutation = useMutation({
		mutationFn: (reactionType: ReactionType) => setReaction(postId, reactionType),
		onMutate: async (reactionType: ReactionType): Promise<OptimisticContext> => {
			await queryClient.cancelQueries({ queryKey: countsKey });
			await queryClient.cancelQueries({ queryKey: myReactionKey });

			const previousCounts = queryClient.getQueryData<Counts>(countsKey);
			const previousMyReaction = queryClient.getQueryData<MyReaction>(myReactionKey);

			const currentReaction = previousMyReaction?.reactionType;

			queryClient.setQueryData<Counts>(countsKey, (old = {}) =>
				applyOptimisticCounts(old, currentReaction, reactionType),
			);
			queryClient.setQueryData<MyReaction>(myReactionKey, { reactionType });

			return { previousCounts, previousMyReaction };
		},
		onError: (_error: Error, _type: ReactionType, context: OptimisticContext | undefined) => {
			if (context?.previousCounts !== undefined) {
				queryClient.setQueryData(countsKey, context.previousCounts);
			}
			if (context?.previousMyReaction !== undefined) {
				queryClient.setQueryData(myReactionKey, context.previousMyReaction);
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: countsKey }),
				queryClient.invalidateQueries({ queryKey: myReactionKey }),
			]);
		},
	});

	const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
	const emoji = myReaction ? reactionEmojis[myReaction.reactionType] : null;

	const handleSelect = (type: ReactionType) => {
		if (myReaction?.reactionType === type) return;
		mutation.mutate(type);
		setSheetOpen(false);
	};

	if (isMobile) {
		return (
			<div className="inline-flex items-center gap-1">
				<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
					<SheetTrigger asChild>
						<button
							type="button"
							aria-label="Reakcje"
							className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-2 sm:py-1"
						>
							<SmilePlusIcon className="h-6 w-6 sm:h-4 sm:w-4" />
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
									aria-label={reactionLabels[type]}
									aria-pressed={myReaction?.reactionType === type}
									className={`min-h-[44px] min-w-[44px] rounded-lg p-3 text-2xl transition-colors hover:bg-accent${myReaction?.reactionType === type ? " bg-accent" : ""}`}
									onClick={() => handleSelect(type)}
								>
									{reactionEmojis[type]}
								</button>
							))}
						</div>
					</SheetContent>
				</Sheet>
				{mutation.isError && <span className="text-xs text-destructive">Nie udało się</span>}
			</div>
		);
	}

	return (
		<div className="inline-flex items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-2 sm:py-1"
					>
						<SmilePlusIcon className="h-4 w-4" />
						<ReactionDisplay counts={counts} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{reactionTypes.map((type) => (
						<DropdownMenuItem key={type} onSelect={() => handleSelect(type)}>
							{reactionEmojis[type]} <span className="sr-only">{reactionLabels[type]}</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			{mutation.isError && <span className="text-xs text-destructive">Nie udało się</span>}
		</div>
	);
}
