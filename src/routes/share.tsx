// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SharePage } from "@/components/share/share-page";
import { getSession } from "@/core/functions/session";

const searchSchema = z.object({
	code: z.string().optional(),
	member: z.string().optional(),
});

export const Route = createFileRoute("/share")({
	validateSearch: searchSchema,
	beforeLoad: async () => {
		const session = await getSession();
		if (session) {
			throw redirect({ to: "/app" });
		}
	},
	component: ShareRoute,
});

function ShareRoute() {
	const { code, member } = Route.useSearch();
	return <SharePage initialCode={code} preselectedMemberId={member} />;
}
