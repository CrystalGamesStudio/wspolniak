// SPDX-License-Identifier: AGPL-3.0-or-later
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pushDeliveryEvents = pgTable(
	"push_delivery_events",
	{
		id: text("id").primaryKey(),
		endpoint: text("endpoint").notNull(),
		userId: text("user_id").notNull(),
		// 'success' | 'gone' (HTTP 410 — subskrypcja usunięta) | 'failure' (non-OK lub throw).
		outcome: text("outcome").notNull(),
		// null gdy sendPush rzucił wyjątek; inaczej HTTP status odpowiedzi.
		statusCode: integer("status_code"),
		// 'post' | 'comment' — co wywołało ten fan-out.
		triggerKind: text("trigger_kind").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		// Wszystkie zapytania (countDeliveriesInWindow, stats) filtrują po oknie 7d.
		index("push_delivery_events_created_at_idx").on(t.createdAt.desc()),
	],
);
