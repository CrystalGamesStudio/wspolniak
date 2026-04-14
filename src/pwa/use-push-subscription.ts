// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useState } from "react";

type PushPermission = "default" | "granted" | "denied" | "unsupported";

interface UsePushSubscriptionResult {
	permission: PushPermission;
	isSubscribed: boolean;
	subscribe: () => Promise<void>;
	unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function usePushSubscription(): UsePushSubscriptionResult {
	const [permission, setPermission] = useState<PushPermission>(() => {
		if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
		return Notification.permission;
	});
	const [isSubscribed, setIsSubscribed] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

		navigator.serviceWorker.ready.then((registration) => {
			registration.pushManager.getSubscription().then((sub) => {
				setIsSubscribed(sub !== null);
			});
		});
	}, []);

	const subscribe = useCallback(async () => {
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

		const result = await Notification.requestPermission();
		setPermission(result);
		if (result !== "granted") return;

		const vapidResponse = await fetch("/api/app/push/vapid-key");
		const vapidData = (await vapidResponse.json()) as { data?: { publicKey: string } };
		if (!vapidData.data) return;

		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidData.data.publicKey).buffer as ArrayBuffer,
		});

		const subJson = subscription.toJSON();
		await fetch("/api/app/push/subscribe", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				endpoint: subJson.endpoint,
				keys: {
					p256dh: subJson.keys?.p256dh,
					auth: subJson.keys?.auth,
				},
			}),
		});

		setIsSubscribed(true);
	}, []);

	const unsubscribe = useCallback(async () => {
		if (!("serviceWorker" in navigator)) return;

		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) return;

		await fetch("/api/app/push/subscribe", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ endpoint: subscription.endpoint }),
		});

		await subscription.unsubscribe();
		setIsSubscribed(false);
	}, []);

	return { permission, isSubscribed, subscribe, unsubscribe };
}
