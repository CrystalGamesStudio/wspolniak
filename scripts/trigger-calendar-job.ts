// SPDX-License-Identifier: AGPL-3.0-or-later
// Ręczny trigger crona kalendarza na bazie DEV — do testów F4/F5.
// `pnpm dev` (vite) nie uruchamia handlera `scheduled` z src/server.ts, a na
// zdeployowanym Workerze cron strzela raz dziennie (06:00 UTC). Ten skrypt woła
// ten sam orkiestrator (runCalendarJob) bezpośrednio, z opcjonalną datą.
//
// Użycie:
//   pnpm calendar:dev:trigger                                  # bieg na "teraz"
//   JOB_DATE='2025-12-28T04:00:00Z' pnpm calendar:dev:trigger  # test przełomu roku

import { runCalendarJob } from "../src/calendar/job";
import { addDaysPoland, polandCalendarDate } from "../src/calendar/timezone";
import { initDatabase } from "../src/db/setup";

const host = process.env.DATABASE_HOST;
const username = process.env.DATABASE_USERNAME;
const password = process.env.DATABASE_PASSWORD;

if (!host || !username || !password) {
	console.error("Brak DATABASE_HOST / DATABASE_USERNAME / DATABASE_PASSWORD (sprawdź .dev.vars)");
	process.exit(1);
}

initDatabase({ host, username, password });

const now = process.env.JOB_DATE ? new Date(process.env.JOB_DATE) : new Date();
const today = polandCalendarDate(now);
const week = addDaysPoland(today, 7);

const pad = (n: number) => String(n).padStart(2, "0");

console.log("");
console.log(`Cron " teraz":  ${now.toISOString()}`);
console.log(`D-0 (dziś, PL): ${today.day}.${pad(today.month)}.${today.year}`);
console.log(`D-7 (za tydzień): ${week.day}.${pad(week.month)}.${week.year}`);
console.log("→ uruchamiam runCalendarJob...");
console.log("");

await runCalendarJob(now);

console.log("Gotowe. Sprawdź Feed w aplikacji:");
console.log("  • wydarzenia na D-0 → post „Dzisiaj: …”");
console.log("  • wydarzenia na D-7 → post „Za tydzień: …”");
console.log("Ponowne odpalenie tego samego dnia nie doda duplikatów (idempotentność).");
