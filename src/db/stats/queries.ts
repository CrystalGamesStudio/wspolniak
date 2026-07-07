// SPDX-License-Identifier: AGPL-3.0-or-later
import { gte, sql } from "drizzle-orm";
import { comments } from "@/db/comments/table";
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
