// SPDX-License-Identifier: AGPL-3.0-or-later
// Orkiestrator crona kalendarza. Handler `scheduled` w wejściu Workera woła
// runCalendarJob; cała logika "znajdź wydarzenia na dziś/za tydzień → post od admina"
// żyje tutaj. Czysty kompozytor tekstu jest eksportowany osobno (testowalny).

import { notifyNewPost } from "@/core/notify";
import { buildPushDeps } from "@/core/push-deps";
import {
	type CalendarEvent,
	claimReminder,
	findEventsByDayMonth,
	type ReminderType,
} from "@/db/calendar";
import { getActiveAdmin } from "@/db/identity";
import { createPost } from "@/db/posts";
import { addDaysPoland, polandCalendarDate, polandFiredFor } from "./timezone";

interface CalendarEventText {
	title: string;
	description: string | null;
}

/** Dokleja opis akapitem pod nagłówek, gdy występuje. Bez emoji (konwencja kalendarza). */
function composeReminderText(header: string, event: CalendarEventText): string {
	return event.description ? `${header}\n\n${event.description}` : header;
}

/** Tekst posta D-0. */
export function composeOnDayText(event: CalendarEventText): string {
	return composeReminderText(`Dzisiaj: ${event.title}`, event);
}

/** Tekst posta D-7. */
export function composeWeekBeforeText(event: CalendarEventText): string {
	return composeReminderText(`Za tydzień: ${event.title}`, event);
}

/**
 * Po utworzeniu posta kalendarza planuje push do rodziny w tle (waitUntil) — nie
 * blokuje zakończenia biegu crona. Admin (autor) nie dostaje powiadomienia, bo
 * getActiveSubscriptions(authorId) go wyklucza. Gdy VAPID nieskonfigurowany
 * (buildPushDeps → null), push jest pomijany, ale post istnieje.
 */
function schedulePostPush(
	env: Env,
	ctx: ExecutionContext,
	authorId: string,
	authorName: string,
	postId: string,
): void {
	const pushDeps = buildPushDeps(env, postId, "post");
	if (!pushDeps) return;
	ctx.waitUntil(notifyNewPost(pushDeps, authorId, authorName, postId));
}

/**
 * Przetwarza jeden koszyk przypomnień: dla każdego wydarzenia atomowo zgłasza
 * roszczenie (claimReminder) i — gdy się uda — tworzy post od admina, a po jego
 * utworzeniu odpala (jeśli podano) powiadomienie push. Błędy per wydarzenie izolowane
 * (awaria jednego nie przerywa pozostałych — cron dowiezie resztę).
 */
async function processBasket(
	events: CalendarEvent[],
	type: ReminderType,
	compose: (event: CalendarEventText) => string,
	adminId: string,
	firedFor: Date,
	notify?: (postId: string) => void,
): Promise<void> {
	for (const evt of events) {
		try {
			const claimedRow = await claimReminder(evt.id, type, firedFor);
			if (!claimedRow) continue;
			const { post } = await createPost({ authorId: adminId, description: compose(evt) });
			notify?.(post.id);
		} catch {}
	}
}

/**
 * Bieg crona kalendarza. Dla bieżącej daty w strefie Europe/Warsaw przetwarza dwa
 * koszyki: D-0 ("Dzisiaj") oraz D-7 ("Za tydzień" — dziś + 7 dni, z przełomem roku).
 * Brak aktywnego admina → pominięcie bez awarii. Gdy przekazano env+ctx, po utworzeniu
 * każdego posta odpalany jest push do rodziny w tle (waitUntil).
 *
 * @param now chwila UTC; wstrzykiwana dla testów (domyślnie teraz).
 * @param env powiązania Workera (VAPID itd.); bez env push jest pomijany.
 * @param ctx kontekst wykonania; `waitUntil` utrzymuje push po powrocie crona.
 */
export async function runCalendarJob(
	now: Date = new Date(),
	env?: Env,
	ctx?: ExecutionContext,
): Promise<void> {
	const date = polandCalendarDate(now);
	const firedFor = polandFiredFor(now);

	const adminUser = await getActiveAdmin();
	if (!adminUser) return;

	const notify =
		env && ctx
			? (postId: string) => schedulePostPush(env, ctx, adminUser.id, adminUser.name, postId)
			: undefined;

	const todayEvents = await findEventsByDayMonth(date.day, date.month);
	await processBasket(todayEvents, "on_day", composeOnDayText, adminUser.id, firedFor, notify);

	const weekAhead = addDaysPoland(date, 7);
	const weekEvents = await findEventsByDayMonth(weekAhead.day, weekAhead.month);
	await processBasket(
		weekEvents,
		"week_before",
		composeWeekBeforeText,
		adminUser.id,
		firedFor,
		notify,
	);
}
