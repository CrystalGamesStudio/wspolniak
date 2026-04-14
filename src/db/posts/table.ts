// SPDX-License-Identifier: AGPL-3.0-or-later
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
	id: text("id").primaryKey(),
	authorId: text("author_id").notNull(),
	description: text("description"),
	deletedAt: timestamp("deleted_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postImages = pgTable("post_images", {
	id: text("id").primaryKey(),
	postId: text("post_id").notNull(),
	cfImageId: text("cf_image_id").notNull(),
	displayOrder: integer("display_order").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
