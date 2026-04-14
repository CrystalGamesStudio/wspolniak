// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const subscribeSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

export type SubscribeRequest = z.infer<typeof subscribeSchema>;

export const unsubscribeSchema = z.object({
	endpoint: z.string().url(),
});

export type UnsubscribeRequest = z.infer<typeof unsubscribeSchema>;
