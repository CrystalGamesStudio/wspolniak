// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	completeSetup,
	getMaintenanceConfig,
	invalidateMaintenanceCache,
	isSetupCompleted,
	updateMaintenance,
} from "./queries";
import { instanceConfig } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

describe("isSetupCompleted", () => {
	it("returns false when no instance_config rows exist", async () => {
		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await isSetupCompleted();
		expect(result).toBe(false);
	});

	it("returns true when a completed config row exists", async () => {
		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ setupCompleted: true }]),
			}),
		});
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await isSetupCompleted();
		expect(result).toBe(true);
	});
});

describe("completeSetup", () => {
	it("inserts a row with familyName and setupCompleted=true", async () => {
		const mockReturning = vi.fn().mockResolvedValue([
			{
				id: "some-id",
				familyName: "Kowalscy",
				setupCompleted: true,
			},
		]);
		const mockInsert = vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({ returning: mockReturning }),
		});
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await completeSetup("Kowalscy");

		expect(mockInsert).toHaveBeenCalledWith(instanceConfig);
		expect(result.familyName).toBe("Kowalscy");
		expect(result.setupCompleted).toBe(true);
	});
});

describe("maintenance config", () => {
	beforeEach(() => invalidateMaintenanceCache());

	function mockSelectRow(row: Record<string, unknown>) {
		const limit = vi.fn().mockResolvedValue([row]);
		const from = vi.fn().mockReturnValue({ limit });
		const select = vi.fn().mockReturnValue({ from });
		mockGetDb.mockReturnValue({ select } as never);
		return { select, from, limit };
	}

	it("returns defaults when maintenance fields are null", async () => {
		mockSelectRow({
			maintenanceMode: false,
			maintenanceMessage: null,
			maintenanceSubtitle: null,
			maintenanceIcon: null,
		});

		const config = await getMaintenanceConfig();

		expect(config).toEqual({
			enabled: false,
			message: "Wspólniak jest w trakcie naprawy",
			subtitle: "Wróć za chwilę",
			icon: "alert-triangle",
		});
	});

	it("returns stored values when fields are set", async () => {
		mockSelectRow({
			maintenanceMode: true,
			maintenanceMessage: "Chwila przerwy",
			maintenanceSubtitle: "Wracamy niedługo",
			maintenanceIcon: "wrench",
		});

		const config = await getMaintenanceConfig();

		expect(config).toEqual({
			enabled: true,
			message: "Chwila przerwy",
			subtitle: "Wracamy niedługo",
			icon: "wrench",
		});
	});

	it("serves cached config on second call without hitting DB again", async () => {
		const { select } = mockSelectRow({ maintenanceMode: false });

		await getMaintenanceConfig();
		await getMaintenanceConfig();

		expect(select).toHaveBeenCalledTimes(1);
	});

	it("re-reads DB after cache is invalidated", async () => {
		const { select } = mockSelectRow({ maintenanceMode: false });

		await getMaintenanceConfig();
		invalidateMaintenanceCache();
		await getMaintenanceConfig();

		expect(select).toHaveBeenCalledTimes(2);
	});
});

describe("updateMaintenance", () => {
	beforeEach(() => invalidateMaintenanceCache());

	function mockUpdateById(rowId: string) {
		const limit = vi.fn().mockResolvedValue([{ id: rowId }]);
		const from = vi.fn().mockReturnValue({ limit });
		const select = vi.fn().mockReturnValue({ from });

		const where = vi.fn().mockResolvedValue([]);
		const set = vi.fn().mockReturnValue({ where });
		const update = vi.fn().mockReturnValue({ set });

		mockGetDb.mockReturnValue({ select, update } as never);
		return { select, update, set };
	}

	it("persists provided fields on the instance_config row", async () => {
		const { set } = mockUpdateById("inst-1");

		await updateMaintenance({ enabled: true, message: "X", subtitle: "Y", icon: "wrench" });

		expect(set).toHaveBeenCalledWith({
			maintenanceMode: true,
			maintenanceMessage: "X",
			maintenanceSubtitle: "Y",
			maintenanceIcon: "wrench",
		});
	});

	it("persists only provided fields and ignores undefined", async () => {
		const { set } = mockUpdateById("inst-1");

		await updateMaintenance({ enabled: true });

		expect(set).toHaveBeenCalledWith({ maintenanceMode: true });
	});

	it("throws when no instance_config row exists", async () => {
		mockUpdateById(""); // select returns [] -> row undefined
		const limit = vi.fn().mockResolvedValue([]);
		const from = vi.fn().mockReturnValue({ limit });
		const select = vi.fn().mockReturnValue({ from });
		const update = vi.fn();
		mockGetDb.mockReturnValue({ select, update } as never);

		await expect(updateMaintenance({ enabled: true })).rejects.toThrow(/no instance_config row/i);
	});

	it("re-reads fresh values after update invalidates cache", async () => {
		let dbRow: Record<string, unknown> = { maintenanceMode: false, id: "inst-1" };
		const limit = vi.fn().mockImplementation(() => Promise.resolve([dbRow]));
		const from = vi.fn().mockReturnValue({ limit });
		const select = vi.fn().mockReturnValue({ from });
		const where = vi.fn().mockResolvedValue([]);
		const set = vi.fn().mockReturnValue({ where });
		const update = vi.fn().mockReturnValue({ set });
		mockGetDb.mockReturnValue({ select, update } as never);

		const first = await getMaintenanceConfig();
		expect(first.enabled).toBe(false);

		dbRow = { maintenanceMode: true, id: "inst-1" }; // simulate persisted change
		await updateMaintenance({ enabled: true }); // invalidates cache

		const second = await getMaintenanceConfig();
		expect(second.enabled).toBe(true);
	});
});
