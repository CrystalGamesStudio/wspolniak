// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SharePage } from "@/components/share/share-page";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/share")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) {
			throw redirect({ to: "/app" });
		}
	},
	component: SharePage,
});
