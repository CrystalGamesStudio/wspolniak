// SPDX-License-Identifier: AGPL-3.0-or-later
// Orkiestrator crona kalendarza. Handler `scheduled` w wejściu Workera woła
// runCalendarJob; cała logika "znajdź wydarzenia na dziś → post od admina"
// żyje tutaj. Czysty kompozytor tekstu jest eksportowany osobno (testowalny).

import { claimReminder, findEventsByDayMonth } from "@/db/calendar";
import { getActiveAdmin } from "@/db/identity";
import { createPost } from "@/db/posts";
import { polandCalendarDate, polandFiredFor } from "./timezone";

interface OnDayEvent {
	title: string;
	description: string | null;
}

/**
 * Tekst posta dla przypomnienia "D-0". Nagłówek "Dzisiaj: {tytuł}", a gdy
 * wydarzenie ma opis — doklejony akapitem niżej. Bez emoji (konwencja kalendarza).
 */
export function composeOnDayText(event: OnDayEvent): string {
	const header = `Dzisiaj: ${event.title}`;
	return event.description ? `${header}\n\n${event.description}` : header;
}

/**
 * Bieg crona D-0. Dla bieżącej daty w strefie Europe/Warsaw: znajduje wydarzenia
 * na "dziś", dla każdego atomowo zgłasza roszczenie (claimReminder) i — gdy się
 * uda — tworzy post od jedynego aktywnego admina. Brak admina → pominięcie
 * bez awarii. Push przychodzi w F5.
 *
 * @param now chwila UTC; wstrzykiwana dla testów (domyślnie teraz).
 */
export async function runCalendarJob(now: Date = new Date()): Promise<void> {
	const date = polandCalendarDate(now);
	const firedFor = polandFiredFor(now);

	const adminUser = await getActiveAdmin();
	if (!adminUser) return;

	const events = await findEventsByDayMonth(date.day, date.month);
	for (const evt of events) {
		// Izolacja błędów per wydarzenie: awaria jednego (claim/createPost) nie
		// może przerywać pozostałych — cron ma dowieźć resztę przypomnień.
		try {
			const claimedRow = await claimReminder(evt.id, "on_day", firedFor);
			if (!claimedRow) continue;
			await createPost({
				authorId: adminUser.id,
				description: composeOnDayText(evt),
			});
		} catch (_err) {}
	}
}
