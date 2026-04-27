// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { MobileNav } from "@/components/app/mobile-nav";
import { PwaShell } from "@/components/pwa/pwa-shell";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/app")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/" });
		}
		return { session };
	},
	component: AppLayout,
});

function AppLayout() {
	const { session } = Route.useRouteContext();

	return (
		<PwaShell>
			<Outlet />
			<MobileNav role={session.role} />
		</PwaShell>
	);
}
