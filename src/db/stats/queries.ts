// SPDX-License-Identifier: AGPL-3.0-or-later
import { gte, sql } from "drizzle-orm";
import { comments } from "@/db/comments/table";
import { users } from "@/db/identity/table";
import { mentions } from "@/db/mentions/table";
import { postReactions } from "@/db/post-reactions/table";
import { postImages, posts } from "@/db/posts/table";
import { countDeliveriesInWindow } from "@/db/push-delivery-events/queries";
import { getDb } from "@/db/setup";

const MS_PER_DAY = 86_400_000;
const WINDOW_7_DAYS_MS = 7 * MS_PER_DAY;

export interface PushDeliveryRate {
	attempts: number;
	successes: number;
	rate: number;
}

export interface StatsSummary {
	dau: number;
	wau: number;
	photosLast7Days: number;
	pushDeliveryLast7Days: PushDeliveryRate;
	// Łącznie w serwisie (COUNT(*) całej tabeli, łącznie z soft-deleted).
	totalPosts: number;
	totalComments: number;
	totalPhotos: number;
	totalReactions: number;
	totalMentions: number;
	windowStart: string;
	windowEnd: string;
}

// distinct author_id z posts ∪ comments w oknie czasowym. Content-based:
// soft-deletes ignorowane — "aktywny" = użytkownik coś utworzył, nawet jeśli
// treść została potem skasowana.
async function getActiveUserCount(since: Date): Promise<number> {
	const result = await getDb().execute(
		sql`select count(*)::int as c from (
			select author_id from ${posts} where created_at >= ${since}
			union
			select author_id from ${comments} where created_at >= ${since}
		) as active_authors`,
	);
	const row = result.rows[0] as { c: number } | undefined;
	return Number(row?.c ?? 0);
}

export function getDailyActiveUsers(now: Date): Promise<number> {
	return getActiveUserCount(new Date(now.getTime() - MS_PER_DAY));
}

export function getWeeklyActiveUsers(now: Date): Promise<number> {
	return getActiveUserCount(new Date(now.getTime() - WINDOW_7_DAYS_MS));
}

export async function getPhotosLast7Days(now: Date): Promise<number> {
	const since = new Date(now.getTime() - WINDOW_7_DAYS_MS);
	const rows = await getDb()
		.select({ count: sql`count(*)`.mapWith(Number) })
		.from(postImages)
		.where(gte(postImages.createdAt, since));
	return rows[0]?.count ?? 0;
}

export async function getPushDeliveryRateLast7Days(now: Date): Promise<PushDeliveryRate> {
	const since = new Date(now.getTime() - WINDOW_7_DAYS_MS);
	const { attempts, successes } = await countDeliveriesInWindow({ from: since, to: now });
	const rate = attempts > 0 ? Number((successes / attempts).toFixed(4)) : 0;
	return { attempts, successes, rate };
}

// Jedno zapytanie — liczy 5 tabel naraz (subqueries). "Łącznie" = COUNT(*)
// całej tabeli, czyli ile kiedykolwiek dodanych (łącznie z soft-deleted).
export async function getTotalCounts(): Promise<{
	posts: number;
	comments: number;
	photos: number;
	reactions: number;
	mentions: number;
}> {
	const result = await getDb().execute(
		sql`select
			(select count(*) from ${posts}) as posts,
			(select count(*) from ${comments}) as comments,
			(select count(*) from ${postImages}) as photos,
			(select count(*) from ${postReactions}) as reactions,
			(select count(*) from ${mentions}) as mentions`,
	);
	const row = result.rows[0] as
		| { posts: number; comments: number; photos: number; reactions: number; mentions: number }
		| undefined;
	return {
		posts: Number(row?.posts ?? 0),
		comments: Number(row?.comments ?? 0),
		photos: Number(row?.photos ?? 0),
		reactions: Number(row?.reactions ?? 0),
		mentions: Number(row?.mentions ?? 0),
	};
}

// Kompozycja wszystkich metryk w jednym wywołaniu (równoległe Promise.all).
// windowStart/windowEnd opisują okno 7-dniowe (dla push/photos/wau).
export async function getStatsSummary(now: Date): Promise<StatsSummary> {
	const windowStart = new Date(now.getTime() - WINDOW_7_DAYS_MS);
	const [dau, wau, photosLast7Days, pushDeliveryLast7Days, totals] = await Promise.all([
		getDailyActiveUsers(now),
		getWeeklyActiveUsers(now),
		getPhotosLast7Days(now),
		getPushDeliveryRateLast7Days(now),
		getTotalCounts(),
	]);
	return {
		dau,
		wau,
		photosLast7Days,
		pushDeliveryLast7Days,
		totalPosts: totals.posts,
		totalComments: totals.comments,
		totalPhotos: totals.photos,
		totalReactions: totals.reactions,
		totalMentions: totals.mentions,
		windowStart: windowStart.toISOString(),
		windowEnd: now.toISOString(),
	};
}

export type LeaderboardCategory =
	| "posts"
	| "comments"
	| "photos"
	| "reactions"
	| "mentions-received"
	| "mentions-made";

export interface LeaderboardEntry {
	name: string;
	count: number;
}

// Publiczny ranking "kto dał najwięcej <czegoś>" dla wszystkich zalogowanych.
// Sort DESC + limit robimy w JS (stabilny tie-break po imieniu; tabele w
// rodzinnie-apce są malutkie, więc pobranie wszystkich zgrupowanych wierszy
// jest tanie). SQL per kategoria: GROUP BY autor/odbiorca + JOIN users (imię
// na żywo) + wykluczenie soft-deleted użytkowników. mentions-made rozwiązuje
// brak kolumny autora w `mentions` jednym UNION autorów przez post i komentarz.
export async function getLeaderboard(
	category: LeaderboardCategory,
	limit: number,
): Promise<LeaderboardEntry[]> {
	const result = await getDb().execute(leaderboardSql(category));
	const rows = (result.rows ?? []) as unknown as LeaderboardEntry[];
	return [...rows]
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.slice(0, limit);
}

function leaderboardSql(category: LeaderboardCategory) {
	switch (category) {
		case "posts":
			return sql`select u.name as name, count(*)::int as count
				from ${posts} p join ${users} u on u.id = p.author_id
				where u.deleted_at is null
				group by p.author_id, u.name`;
		case "comments":
			return sql`select u.name as name, count(*)::int as count
				from ${comments} c join ${users} u on u.id = c.author_id
				where u.deleted_at is null
				group by c.author_id, u.name`;
		case "photos":
			// Autor zdjęcia = autor posta (post_images nie ma własnego autora).
			return sql`select u.name as name, count(*)::int as count
				from ${postImages} pi
				join ${posts} p on p.id = pi.post_id
				join ${users} u on u.id = p.author_id
				where u.deleted_at is null
				group by p.author_id, u.name`;
		case "reactions":
			// Kto rozdał najwięcej reakcji (user_id na reakcji = dawca).
			return sql`select u.name as name, count(*)::int as count
				from ${postReactions} r join ${users} u on u.id = r.user_id
				where u.deleted_at is null
				group by r.user_id, u.name`;
		case "mentions-received":
			// Kto został wspomniany najczęściej (mentions.user_id = odbiorca).
			return sql`select u.name as name, count(*)::int as count
				from ${mentions} m join ${users} u on u.id = m.user_id
				where u.deleted_at is null
				group by m.user_id, u.name`;
		case "mentions-made": {
			// Tabela mentions nie ma kolumny autora → wyprowadzamy go przez post
			// (mention w opisie, comment_id IS NULL) lub komentarz (comment_id IS
			// NOT NULL). UNION ALL liczy każdy mention osobno (bez deduplikacji).
			return sql`select u.name as name, count(*)::int as count
				from (
					select p.author_id as author_id
					from ${mentions} m join ${posts} p on p.id = m.post_id
					where m.comment_id is null
					union all
					select c.author_id as author_id
					from ${mentions} m join ${comments} c on c.id = m.comment_id
					where m.comment_id is not null
				) as authors
				join ${users} u on u.id = authors.author_id
				where u.deleted_at is null
				group by authors.author_id, u.name`;
		}
		default:
			throw new Error(`Unsupported leaderboard category: ${category}`);
	}
}
