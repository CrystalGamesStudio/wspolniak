// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildPushPayload, fanOutPush, type PushPayload, type SubscriptionInfo } from "./push";

describe("buildPushPayload", () => {
	it("builds payload for a new post notification", () => {
		const payload = buildPushPayload({
			type: "new_post",
			authorName: "Mama",
			postId: "post-123",
		});

		expect(payload).toEqual({
			title: "Mama dodał(a) zdjęcie",
			body: "",
			icon: "/logo192.png",
			url: "/app/posts/post-123",
		});
	});

	it("builds payload for a new comment notification", () => {
		const payload = buildPushPayload({
			type: "new_comment",
			authorName: "Tata",
			postId: "post-456",
			snippet: "Super zdjęcie!",
		});

		expect(payload).toEqual({
			title: "Tata skomentował(a) Twoje zdjęcie",
			body: "Super zdjęcie!",
			icon: "/logo192.png",
			url: "/app/posts/post-456",
		});
	});
});

describe("fanOutPush", () => {
	const payload: PushPayload = {
		title: "Test",
		body: "body",
		icon: "/logo192.png",
		url: "/app/posts/p1",
	};

	const sub1: SubscriptionInfo = {
		endpoint: "https://push.example.com/sub1",
		p256dh: "key1",
		auth: "auth1",
	};
	const sub2: SubscriptionInfo = {
		endpoint: "https://push.example.com/sub2",
		p256dh: "key2",
		auth: "auth2",
	};

	it("sends push to all provided subscriptions", async () => {
		const sendPush = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
		const deleteSubscription = vi.fn();

		await fanOutPush({
			subscriptions: [sub1, sub2],
			payload,
			sendPush,
			deleteSubscription,
		});

		expect(sendPush).toHaveBeenCalledTimes(2);
		expect(sendPush).toHaveBeenCalledWith(sub1, payload);
		expect(sendPush).toHaveBeenCalledWith(sub2, payload);
		expect(deleteSubscription).not.toHaveBeenCalled();
	});

	it("deletes subscription on 410 Gone response", async () => {
		const sendPush = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));
		const deleteSubscription = vi.fn();

		await fanOutPush({
			subscriptions: [sub1],
			payload,
			sendPush,
			deleteSubscription,
		});

		expect(deleteSubscription).toHaveBeenCalledWith(sub1.endpoint);
	});

	it("calls onSendError on non-410 failure without deleting", async () => {
		const sendPush = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
		const deleteSubscription = vi.fn();
		const onSendError = vi.fn();

		await fanOutPush({
			subscriptions: [sub1],
			payload,
			sendPush,
			deleteSubscription,
			onSendError,
		});

		expect(deleteSubscription).not.toHaveBeenCalled();
		expect(onSendError).toHaveBeenCalledWith(sub1.endpoint, 500);
	});

	it("handles empty subscriptions list", async () => {
		const sendPush = vi.fn();
		const deleteSubscription = vi.fn();

		await fanOutPush({
			subscriptions: [],
			payload,
			sendPush,
			deleteSubscription,
		});

		expect(sendPush).not.toHaveBeenCalled();
	});
});
