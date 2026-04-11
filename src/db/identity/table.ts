import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	role: text("role").notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	deletedAt: timestamp("deleted_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
