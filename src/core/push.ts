// SPDX-License-Identifier: AGPL-3.0-or-later
type PushPayloadInput =
	| { type: "new_post"; authorName: string; postId: string }
	| { type: "new_comment"; authorName: string; postId: string; snippet: string };

export interface PushPayload {
	title: string;
	body: string;
	icon: string;
	url: string;
}

export interface SubscriptionInfo {
	endpoint: string;
	p256dh: string;
	auth: string;
}

interface FanOutDeps {
	subscriptions: SubscriptionInfo[];
	payload: PushPayload;
	sendPush: (subscription: SubscriptionInfo, payload: PushPayload) => Promise<Response>;
	deleteSubscription: (endpoint: string) => Promise<unknown>;
	onSendError?: (endpoint: string, status: number) => void;
}

const ICON = "/icons/icon-192x192.png";

export function buildPushPayload(input: PushPayloadInput): PushPayload {
	switch (input.type) {
		case "new_post":
			return {
				title: `${input.authorName} dodał(a) zdjęcie`,
				body: "",
				icon: ICON,
				url: `/app/posts/${input.postId}`,
			};
		case "new_comment":
			return {
				title: `${input.authorName} skomentował(a) Twoje zdjęcie`,
				body: input.snippet,
				icon: ICON,
				url: `/app/posts/${input.postId}`,
			};
	}
}

export async function fanOutPush({
	subscriptions,
	payload,
	sendPush,
	deleteSubscription,
	onSendError,
}: FanOutDeps): Promise<void> {
	await Promise.allSettled(
		subscriptions.map(async (sub) => {
			const response = await sendPush(sub, payload);
			if (response.status === 410) {
				await deleteSubscription(sub.endpoint);
			} else if (!response.ok) {
				onSendError?.(sub.endpoint, response.status);
			}
		}),
	);
}
