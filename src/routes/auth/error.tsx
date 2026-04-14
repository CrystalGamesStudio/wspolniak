// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute } from "@tanstack/react-router";
import { AuthErrorPage } from "@/components/auth/auth-error-page";

export const Route = createFileRoute("/auth/error")({
	component: AuthErrorPage,
});
