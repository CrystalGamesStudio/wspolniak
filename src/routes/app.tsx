import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppPage } from "@/components/app/app-page";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/app")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/" });
		}
		return { session };
	},
	component: () => {
		const { session } = Route.useRouteContext();
		return <AppPage name={session.name} />;
	},
});
