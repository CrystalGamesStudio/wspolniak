// SPDX-License-Identifier: AGPL-3.0-or-later
import { Flame, Heart, Laugh, type LucideIcon } from "lucide-react";
import type { ReactionTarget } from "@/db/post-reactions/queries";
import { type ReactionType, reactionTypes } from "@/db/post-reactions/table";

export interface ReactionConfigEntry {
	Icon: LucideIcon;
	label: string;
	/** CSS color applied to the icon when the reaction is selected. */
	color: string;
	/** Whether the icon is drawn solid (filled) vs outline when selected. */
	filled: boolean;
}

export const REACTION_CONFIG: Record<ReactionType, ReactionConfigEntry> = {
	heart: { Icon: Heart, label: "serce", color: "#e42324", filled: true },
	laugh: { Icon: Laugh, label: "śmiech", color: "#0070e1", filled: false },
	flame: { Icon: Flame, label: "ogień", color: "#e47600", filled: true },
};

export const REACTION_ORDER: readonly ReactionType[] = reactionTypes;

/** Stable, target-scoped query/cache key shared by ReactionBar and ReactionUsers. */
export function targetKey(target: ReactionTarget): readonly unknown[] {
	return target.kind === "post"
		? (["reactions", "post", target.postId] as const)
		: (["reactions", "comment", target.postId, target.commentId] as const);
}

export function targetUrls(target: ReactionTarget): {
	counts: string;
	myReaction: string;
	users: string;
} {
	const base =
		target.kind === "post"
			? `/api/app/posts/${target.postId}`
			: `/api/app/posts/${target.postId}/comments/${target.commentId}`;
	return {
		counts: `${base}/reactions`,
		myReaction: `${base}/my-reaction`,
		users: `${base}/reactions/users`,
	};
}
