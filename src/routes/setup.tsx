// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, redirect } from "@tanstack/react-router";
import { SetupPage } from "@/components/setup/setup-page";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/setup")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) {
			throw redirect({ to: "/app" });
		}
	},
	component: SetupPage,
});
