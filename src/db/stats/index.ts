// SPDX-License-Identifier: AGPL-3.0-or-later
// Deep module: publiczny interfejs to tylko getStatsSummary + typ. Pojedyncze
// metryki (getDailyActiveUsers itd.) są internal — nie eksportujemy ich stąd.
export { getStatsSummary, type StatsSummary } from "./queries";
