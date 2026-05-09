// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DesktopSidebar } from "@/components/app/desktop-sidebar";
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
			<DesktopSidebar role={session.role} />
			<main className="sm:ml-[240px]">
				<Outlet />
			</main>
			<MobileNav role={session.role} />
		</PwaShell>
	);
}
