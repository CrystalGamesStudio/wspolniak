// SPDX-License-Identifier: AGPL-3.0-or-later
// Orkiestrator crona kalendarza. Handler `scheduled` w wejściu Workera woła
// runCalendarJob; cała logika "znajdź wydarzenia na dziś/za tydzień → post od admina"
// żyje tutaj. Czysty kompozytor tekstu jest eksportowany osobno (testowalny).

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
 * Przetwarza jeden koszyk przypomnień: dla każdego wydarzenia atomowo zgłasza
 * roszczenie (claimReminder) i — gdy się uda — tworzy post od admina. Błędy per
 * wydarzenie izolowane (awaria jednego nie przerywa pozostałych — cron dowiezie resztę).
 */
async function processBasket(
	events: CalendarEvent[],
	type: ReminderType,
	compose: (event: CalendarEventText) => string,
	adminId: string,
	firedFor: Date,
): Promise<void> {
	for (const evt of events) {
		try {
			const claimedRow = await claimReminder(evt.id, type, firedFor);
			if (!claimedRow) continue;
			await createPost({ authorId: adminId, description: compose(evt) });
		} catch (_err) {}
	}
}

/**
 * Bieg crona kalendarza. Dla bieżącej daty w strefie Europe/Warsaw przetwarza dwa
 * koszyki: D-0 ("Dzisiaj") oraz D-7 ("Za tydzień" — dziś + 7 dni, z przełomem roku).
 * Brak aktywnego admina → pominięcie bez awarii. Push przychodzi w F5.
 *
 * @param now chwila UTC; wstrzykiwana dla testów (domyślnie teraz).
 */
export async function runCalendarJob(now: Date = new Date()): Promise<void> {
	const date = polandCalendarDate(now);
	const firedFor = polandFiredFor(now);

	const adminUser = await getActiveAdmin();
	if (!adminUser) return;

	const todayEvents = await findEventsByDayMonth(date.day, date.month);
	await processBasket(todayEvents, "on_day", composeOnDayText, adminUser.id, firedFor);

	const weekAhead = addDaysPoland(date, 7);
	const weekEvents = await findEventsByDayMonth(weekAhead.day, weekAhead.month);
	await processBasket(weekEvents, "week_before", composeWeekBeforeText, adminUser.id, firedFor);
}
