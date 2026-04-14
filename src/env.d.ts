// SPDX-License-Identifier: AGPL-3.0-or-later
declare namespace Cloudflare {
	interface Env {
		VAPID_PUBLIC_KEY?: string;
		VAPID_PRIVATE_KEY?: string;
		VAPID_SUBJECT?: string;
	}
}
