// SPDX-License-Identifier: AGPL-3.0-or-later
import { completeSetup, isSetupCompleted } from "./queries";
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
