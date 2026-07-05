// SPDX-License-Identifier: AGPL-3.0-or-later

import * as LucideIcons from "lucide-react";
import { AlertTriangle, type LucideIcon } from "lucide-react";

export interface MaintenanceOverlayProps {
	message: string;
	subtitle: string;
	icon: string;
}

export interface MaintenanceDecisionInput {
	enabled: boolean;
}

export function shouldShowMaintenanceOverlay(
	config: MaintenanceDecisionInput,
	role: string,
): boolean {
	return config.enabled && role !== "admin";
}

const FALLBACK_ICON_KEY = "alert-triangle";
const iconRegistry = LucideIcons as unknown as Record<string, LucideIcon>;

function resolveIconKey(name: string): string {
	if (name && iconRegistry[toPascalCase(name)]) return name;
	return FALLBACK_ICON_KEY;
}

function toPascalCase(name: string): string {
	return name
		.split(/[-_\s]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join("");
}

export function MaintenanceOverlay({ message, subtitle, icon }: MaintenanceOverlayProps) {
	const iconKey = resolveIconKey(icon);
	const Icon = iconRegistry[toPascalCase(iconKey)] ?? AlertTriangle;

	return (
		<div
			role="alertdialog"
			aria-modal="true"
			className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center"
		>
			<Icon
				role="img"
				aria-label={iconKey}
				className="h-24 w-24 shrink-0 text-warning"
				strokeWidth={2}
			/>
			<h1 className="max-w-md text-2xl font-bold text-foreground">{message}</h1>
			<p className="max-w-md text-base text-muted-foreground">{subtitle}</p>
		</div>
	);
}
