// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PushPayload, SubscriptionInfo } from "@/core/push";
import { buildPushPayload, fanOutPush } from "@/core/push";

interface NotifyDeps {
	getActiveSubscriptions: (excludeUserId: string) => Promise<SubscriptionInfo[]>;
	getSubscriptionsByUserId: (userId: string) => Promise<SubscriptionInfo[]>;
	sendPush: (subscription: SubscriptionInfo, payload: PushPayload) => Promise<Response>;
	deleteSubscription: (endpoint: string) => Promise<unknown>;
}

export async function notifyNewPost(
	deps: NotifyDeps,
	authorId: string,
	authorName: string,
	postId: string,
): Promise<void> {
	const subscriptions = await deps.getActiveSubscriptions(authorId);
	const payload = buildPushPayload({ type: "new_post", authorName, postId });
	await fanOutPush({
		subscriptions,
		payload,
		sendPush: deps.sendPush,
		deleteSubscription: deps.deleteSubscription,
	});
}

export async function notifyNewComment(
	deps: NotifyDeps,
	commentAuthorId: string,
	commentAuthorName: string,
	postAuthorId: string,
	postId: string,
	snippet: string,
): Promise<void> {
	if (commentAuthorId === postAuthorId) return;

	const subscriptions = await deps.getSubscriptionsByUserId(postAuthorId);
	const payload = buildPushPayload({
		type: "new_comment",
		authorName: commentAuthorName,
		postId,
		snippet,
	});
	await fanOutPush({
		subscriptions,
		payload,
		sendPush: deps.sendPush,
		deleteSubscription: deps.deleteSubscription,
	});
}
