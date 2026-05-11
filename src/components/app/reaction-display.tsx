// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactionType } from "@/db/post-reactions/table";

const reactionEmojis: Record<ReactionType, string> = {
	heart: "❤️",
	thumbs_up: "👍",
	thumbs_down: "👎",
	laugh: "😂",
	emphasize: "‼️",
	question: "❓",
};

interface ReactionDisplayProps {
	counts: Record<string, number>;
}

export function ReactionDisplay({ counts }: ReactionDisplayProps) {
	const entries = Object.entries(counts).filter(([, count]) => count > 0);

	if (entries.length === 0) {
		return <span className="text-sm text-muted-foreground">0</span>;
	}

	return (
		<span className="inline-flex items-center gap-1 overflow-x-auto text-sm text-muted-foreground">
			{entries.map(([type, count]) => (
				<span key={type} className="inline-flex items-center gap-0.5 whitespace-nowrap">
					{reactionEmojis[type as ReactionType]} {count}
				</span>
			))}
		</span>
	);
}
