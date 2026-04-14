// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) {
			throw redirect({ to: "/app" });
		}
	},
	component: () => {
		return <LandingPage isAuthenticated={false} />;
	},
});
