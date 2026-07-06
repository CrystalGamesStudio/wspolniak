// SPDX-License-Identifier: AGPL-3.0-or-later
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Rejestr @mention: kto (userId) został wspomniany, w którym poście (postId)
 * i opcjonalnie w którym komentarzu (commentId).
 *
 * userId pochodzi ZAWSZE z kliknięcia w dropdown (nie z parsowania imienia),
 * dlatego ta tabela jest jedynym źródłem prawdy o tym, kto dostanie powiadomienie.
 * Ręcznie wpisany `@imię` nie tworzy tu wiersza → brak pusha (patrz notifyMentions).
 */
export const mentions = pgTable("mentions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	postId: text("post_id").notNull(),
	// Null = mention w opisie posta; nie-null = mention w konkretnym komentarzu.
	commentId: text("comment_id"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
