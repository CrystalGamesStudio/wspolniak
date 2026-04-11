import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/landing-page";
import { getSession } from "@/core/functions/session";

export const Route = createFileRoute("/")({
	loader: async () => {
		const session = await getSession();
		return { isAuthenticated: !!session };
	},
	component: () => {
		const { isAuthenticated } = Route.useLoaderData();
		return <LandingPage isAuthenticated={isAuthenticated} />;
	},
});
