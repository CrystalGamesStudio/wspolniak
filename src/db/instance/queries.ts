// SPDX-License-Identifier: AGPL-3.0-or-later
import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { instanceConfig } from "./table";

export async function isSetupCompleted(): Promise<boolean> {
	const rows = await getDb()
		.select()
		.from(instanceConfig)
		.where(eq(instanceConfig.setupCompleted, true));
	return rows.length > 0;
}

export async function completeSetup(familyName: string) {
	const id = crypto.randomUUID();
	const rows = await getDb()
		.insert(instanceConfig)
		.values({ id, familyName, setupCompleted: true })
		.returning();
	const row = rows[0];
	if (!row) throw new Error("completeSetup: insert returned no rows");
	return row;
}

export const DEFAULT_MAINTENANCE_CONFIG = {
	enabled: false,
	message: "Wspólniak jest w trakcie naprawy",
	subtitle: "Wróć za chwilę",
	icon: "alert-triangle",
} as const;

export interface MaintenanceConfig {
	enabled: boolean;
	message: string;
	subtitle: string;
	icon: string;
}

export interface MaintenanceUpdate {
	enabled?: boolean;
	message?: string;
	subtitle?: string;
	icon?: string;
}

const MAINTENANCE_CACHE_TTL_MS = 60_000;
let maintenanceCache: { data: MaintenanceConfig; expiresAt: number } | null = null;

export function invalidateMaintenanceCache(): void {
	maintenanceCache = null;
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
	if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) {
		return maintenanceCache.data;
	}
	const rows = await getDb()
		.select({
			maintenanceMode: instanceConfig.maintenanceMode,
			maintenanceMessage: instanceConfig.maintenanceMessage,
			maintenanceSubtitle: instanceConfig.maintenanceSubtitle,
			maintenanceIcon: instanceConfig.maintenanceIcon,
		})
		.from(instanceConfig)
		.limit(1);
	const row = rows[0];
	const config: MaintenanceConfig = {
		enabled: row?.maintenanceMode ?? DEFAULT_MAINTENANCE_CONFIG.enabled,
		message: row?.maintenanceMessage ?? DEFAULT_MAINTENANCE_CONFIG.message,
		subtitle: row?.maintenanceSubtitle ?? DEFAULT_MAINTENANCE_CONFIG.subtitle,
		icon: row?.maintenanceIcon ?? DEFAULT_MAINTENANCE_CONFIG.icon,
	};
	maintenanceCache = { data: config, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
	return config;
}

export async function updateMaintenance(input: MaintenanceUpdate): Promise<void> {
	const rows = await getDb().select({ id: instanceConfig.id }).from(instanceConfig).limit(1);
	const row = rows[0];
	if (!row) throw new Error("updateMaintenance: no instance_config row");

	const set: Record<string, unknown> = {};
	if (input.enabled !== undefined) set.maintenanceMode = input.enabled;
	if (input.message !== undefined) set.maintenanceMessage = input.message;
	if (input.subtitle !== undefined) set.maintenanceSubtitle = input.subtitle;
	if (input.icon !== undefined) set.maintenanceIcon = input.icon;

	if (Object.keys(set).length > 0) {
		await getDb().update(instanceConfig).set(set).where(eq(instanceConfig.id, row.id));
	}
	invalidateMaintenanceCache();
}
