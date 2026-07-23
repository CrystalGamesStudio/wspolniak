// SPDX-License-Identifier: AGPL-3.0-or-later

export type {
	MaintenanceConfig,
	MaintenanceUpdate,
	YoutubeConnection,
	YoutubeConnectionInput,
} from "./queries";
export {
	clearYoutubeConnection,
	completeSetup,
	DEFAULT_MAINTENANCE_CONFIG,
	getMaintenanceConfig,
	getYoutubeConnection,
	invalidateMaintenanceCache,
	isSetupCompleted,
	setYoutubeConnection,
	updateMaintenance,
} from "./queries";
export { instanceConfig } from "./table";
