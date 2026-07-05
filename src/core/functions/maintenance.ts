// SPDX-License-Identifier: AGPL-3.0-or-later
import { createServerFn } from "@tanstack/react-start";
import { getMaintenanceConfig } from "@/db/instance/queries";

export const getMaintenanceState = createServerFn({ method: "GET" }).handler(async () => {
	return getMaintenanceConfig();
});
