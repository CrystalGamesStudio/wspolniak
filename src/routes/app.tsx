import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
	component: () => (
		<PwaShell>
			<Outlet />
		</PwaShell>
	),
});
