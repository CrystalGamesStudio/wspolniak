// SPDX-License-Identifier: AGPL-3.0-or-later

export interface FeedImage {
	id: string;
	postId: string;
	cfImageId: string;
	displayOrder: number;
	createdAt: string;
}

export interface FeedPost {
	id: string;
	authorId: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; name: string };
	images: FeedImage[];
	commentCount?: number;
	pinned?: boolean;
}

export interface FeedPage {
	data: FeedPost[];
	meta: {
		nextCursor: { createdAt: string; id: string } | null;
		imageAccountHash: string;
	};
}

/** Klucz infinite query feedu w cache TanStack Query. */
export const feedQueryKey = ["posts"] as const;
