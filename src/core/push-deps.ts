// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PushPayload, SubscriptionInfo } from "@/core/push";
import { createSendWebPushFromEnv } from "@/core/web-push";
import { type DeliveryTriggerKind, recordDelivery } from "@/db/push-delivery-events/queries";
import {
	deleteSubscriptionByEndpoint,
	getActiveSubscriptions,
	getSubscriptionsByUserId,
} from "@/db/push-subscriptions/queries";

/** Zależności potrzebne funkcjom notify* (notify.ts) do wysyłki push. */
export interface PushDeps {
	getActiveSubscriptions: (excludeUserId: string) => Promise<SubscriptionInfo[]>;
	getSubscriptionsByUserId: (userId: string) => Promise<SubscriptionInfo[]>;
	sendPush: (subscription: SubscriptionInfo, payload: PushPayload) => Promise<Response>;
	deleteSubscription: (endpoint: string) => Promise<unknown>;
	onSendError?: (endpoint: string, status: number) => void;
	onSendOutcome?: (
		outcome: "success" | "gone" | "failure",
		endpoint: string,
		userId: string,
		statusCode: number | null,
	) => void | Promise<void>;
}

/**
 * Buduje PushDeps (sendPush z logowaniem błędów dostarczenia + zapytania o subskrypcje)
 * dla danego środowiska. Zwraca null, gdy VAPID nie jest skonfigurowany — wtedy push
 * jest całkowicie wyłączony. Współdzielone przez endpointy komentarzy i postów.
 */
export function buildPushDeps(
	env: Env,
	postId: string,
	kind: DeliveryTriggerKind,
): PushDeps | null {
	const baseSendPush = createSendWebPushFromEnv(env);
	if (!baseSendPush) return null;

	const sendPush: typeof baseSendPush = async (subscription, payload) => {
		try {
			const res = await baseSendPush(subscription, payload);
			if (!res.ok && res.status !== 410) {
				const body = await res
					.clone()
					.text()
					.catch(() => "<no body>");
				// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
				console.error("[push] non-OK response", {
					status: res.status,
					endpoint: subscription.endpoint,
					body,
				});
			}
			return res;
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
			console.error("[push] threw", { endpoint: subscription.endpoint, error: String(error) });
			throw error;
		}
	};

	return {
		getActiveSubscriptions,
		getSubscriptionsByUserId,
		sendPush,
		deleteSubscription: deleteSubscriptionByEndpoint,
		onSendError: (endpoint, status) => {
			// biome-ignore lint/suspicious/noConsole: surface push delivery failures in `wrangler tail`
			console.error("[push] send failed", { status, endpoint, postId, kind });
		},
		onSendOutcome: async (outcome, endpoint, userId, statusCode) => {
			// Defensive: błąd zapisu delivery event NIE może wywrócić push fan-out.
			// Bez tego pomyłka w DB = brak powiadomień dla rodziny.
			try {
				await recordDelivery({ endpoint, userId, outcome, statusCode, triggerKind: kind });
			} catch (error) {
				// biome-ignore lint/suspicious/noConsole: surface delivery-log failures in `wrangler tail`
				console.error("[push] recordDelivery failed", { error: String(error) });
			}
		},
	};
}
