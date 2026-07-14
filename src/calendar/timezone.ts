// SPDX-License-Identifier: AGPL-3.0-or-later
// Czysta logika dat UTC ↔ Europe/Warsaw. Cron Workers działa w UTC, ale "dziś"
// oraz "za tydzień" liczymy w czasie polskim (z obsługą DST). Wszystkie daty
// reminderów normalizujemy do stabilnego midnight-UTC per dzień polski — to
// gwarantuje idempotentność claimReminder między kolejnymi biegami crona.

export interface CalendarDate {
	day: number; // 1–31
	month: number; // 1–12
	year: number;
}

/**
 * Zwraca dzień/miesiąc/rok dla chwili UTC rozpatrzonej w strefie Europe/Warsaw.
 * Intl.DateTimeFormat aplikuje reguły DST (CET/CEST), więc wynik jest poprawny
 * niezależnie od pory roku.
 */
export function polandCalendarDate(now: Date): CalendarDate {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Warsaw",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(now);

	const get = (type: string): number => {
		const part = parts.find((p) => p.type === type);
		return part ? Number(part.value) : NaN;
	};

	return {
		day: get("day"),
		month: get("month"),
		year: get("year"),
	};
}

/**
 * Stabilny identyfikator "dnia polskiego" jako Date (midnight UTC dnia kalendarzowego).
 * Dowolna chwila UTC w tym samym dniu PL daje ten sam timestamp — klucz do UNIQUE
 * (event_id, type, fired_for) w calendar_reminder_log.
 */
export function polandFiredFor(now: Date): Date {
	const { year, month, day } = polandCalendarDate(now);
	return new Date(Date.UTC(year, month - 1, day));
}
