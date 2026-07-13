// SPDX-License-Identifier: AGPL-3.0-or-later
// Deep module: publiczny interfejs to getStatsSummary + getLeaderboard + typy.
// Pojedyncze metryki (getDailyActiveUsers itd.) są internal — nie eksportujemy.
export {
	getLeaderboard,
	getStatsSummary,
	type LeaderboardCategory,
	type LeaderboardEntry,
	type StatsSummary,
} from "./queries";
