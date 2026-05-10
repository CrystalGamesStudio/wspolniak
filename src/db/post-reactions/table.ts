// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const reactionTypes = [
	"heart",
	"thumbs_up",
	"thumbs_down",
	"laugh",
	"emphasize",
	"question",
] as const;
export type ReactionType = (typeof reactionTypes)[number];

export const postReactions = pgTable(
	"post_reactions",
	{
		id: text("id").primaryKey(),
		postId: text("post_id").notNull(),
		userId: text("user_id").notNull(),
		reactionType: text("reaction_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("post_reactions_post_id_user_id_idx").on(t.postId, t.userId)],
);
