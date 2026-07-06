// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const pinnedPosts = pgTable(
	"pinned_posts",
	{
		id: text("id").primaryKey(),
		postId: text("post_id").notNull(),
		pinnedAt: timestamp("pinned_at").defaultNow().notNull(),
	},
	(t) => [uniqueIndex("pinned_posts_post_id_idx").on(t.postId)],
);
