// SPDX-License-Identifier: AGPL-3.0-or-later

export type { MaintenanceConfig, MaintenanceUpdate } from "./queries";
export {
	completeSetup,
	DEFAULT_MAINTENANCE_CONFIG,
	getMaintenanceConfig,
	invalidateMaintenanceCache,
	isSetupCompleted,
	updateMaintenance,
} from "./queries";
export { instanceConfig } from "./table";
