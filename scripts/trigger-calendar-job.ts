// SPDX-License-Identifier: AGPL-3.0-or-later
// Ręczny trigger crona kalendarza na bazie DEV — do testów F4/F5.
// `pnpm dev` (vite) nie uruchamia handlera `scheduled` z src/server.ts, a na
// zdeployowanym Workerze cron strzela raz dziennie (06:00 UTC). Ten skrypt woła
// ten sam orkiestrator (runCalendarJob) bezpośrednio, z opcjonalną datą, przekazując
// env (VAPID) i ctx (waitUntil) — dzięki czemu F5 (push) też się odpali.
//
// Użycie:
//   pnpm calendar:dev:trigger                                  # bieg na "teraz"
//   JOB_DATE='2025-12-28T04:00:00Z' pnpm calendar:dev:trigger  # test przełomu roku
//
// Uwaga: żeby push rzeczycznie dotarł, w .dev.vars muszą być VAPID_PUBLIC_KEY i
// VAPID_PRIVATE_KEY, a w bazie DEV musi istnieć subskrypcja push członka rodziny.

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

// env z .dev.vars (DATABASE_*, APP_URL, a do F5: VAPID_*). buildPushDeps czyta
// tylko VAPID_*, więc ich brak = push pominięty, ale posty powstaną normalnie.
const env = process.env as unknown as Env;

// W skrypcie (Node) proces zakończyłby się przed wysyłką push, więc waitUntil zbiera
// obietnice i czekamy na nie przed wyjściem. W prawdziwym Workerze waitUntil przedłuża
// żywotność, ale ich nie awaituje — orkiestrator polega na tym (push w tle).
const pending: Promise<unknown>[] = [];
const ctx = {
	waitUntil: (p: Promise<unknown>) => {
		pending.push(p);
	},
} as unknown as ExecutionContext;

const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

console.log("");
console.log(`Cron "teraz":     ${now.toISOString()}`);
console.log(`D-0 (dziś, PL):   ${today.day}.${pad(today.month)}.${today.year}`);
console.log(`D-7 (za tydzień): ${week.day}.${pad(week.month)}.${week.year}`);
console.log(
	`Push (VAPID):     ${vapidConfigured ? "skonfigurowany — F5 wyśle powiadomienia" : "BRAK w .dev.vars → push pominięty (posty powstaną normalnie)"}`,
);
console.log("→ uruchamiam runCalendarJob...");
console.log("");

await runCalendarJob(now, env, ctx);

if (pending.length > 0) {
	console.log(`→ czekam na ${pending.length} wysyłkę/ki push w tle...`);
	await Promise.allSettled(pending);
}

console.log("");
console.log("Gotowe. Sprawdź Feed w aplikacji:");
console.log("  • wydarzenia na D-0 → post „Dzisiaj: …”");
console.log("  • wydarzenia na D-7 → post „Za tydzień: …”");
if (vapidConfigured) {
	console.log("  • powiadomienie push powinno dotrzeć do członków rodziny (NIE do admina)");
}
console.log("Ponowne odpalenie tego samego dnia nie doda duplikatów (idempotentność).");
