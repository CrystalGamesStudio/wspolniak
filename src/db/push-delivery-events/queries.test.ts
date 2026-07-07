// SPDX-License-Identifier: AGPL-3.0-or-later
import { countDeliveriesInWindow, recordDelivery } from "./queries";
import { pushDeliveryEvents } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

describe("recordDelivery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("inserts a delivery event with a generated id", async () => {
		const values = vi.fn().mockResolvedValue(undefined);
		const insert = vi.fn().mockReturnValue({ values });
		mockGetDb.mockReturnValue({ insert } as never);

		await recordDelivery({
			endpoint: "https://web.push/ep",
			userId: "u1",
			outcome: "success",
			statusCode: 201,
			triggerKind: "post",
		});

		expect(insert).toHaveBeenCalledWith(pushDeliveryEvents);
		const call = values.mock.calls[0]?.[0];
		expect(call).toMatchObject({
			endpoint: "https://web.push/ep",
			userId: "u1",
			outcome: "success",
			statusCode: 201,
			triggerKind: "post",
		});
		expect(typeof call?.id).toBe("string");
		expect(call.id.length).toBeGreaterThan(0);
	});
});

describe("countDeliveriesInWindow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function setupSelect(rows: Array<{ outcome: string; count: number }>) {
		const groupBy = vi.fn().mockResolvedValue(rows);
		const where = vi.fn().mockReturnValue({ groupBy });
		const from = vi.fn().mockReturnValue({ where });
		const select = vi.fn().mockReturnValue({ from });
		mockGetDb.mockReturnValue({ select } as never);
		return { select, from, where, groupBy };
	}

	it("sums attempts and counts successes across outcomes", async () => {
		setupSelect([
			{ outcome: "success", count: 8 },
			{ outcome: "failure", count: 2 },
		]);

		const result = await countDeliveriesInWindow({ from: new Date(0), to: new Date(1) });

		expect(result).toEqual({ attempts: 10, successes: 8 });
	});

	it("ignores 'gone' outcomes when counting successes", async () => {
		setupSelect([
			{ outcome: "success", count: 5 },
			{ outcome: "gone", count: 3 },
		]);

		const result = await countDeliveriesInWindow({ from: new Date(0), to: new Date(1) });

		expect(result).toEqual({ attempts: 8, successes: 5 });
	});

	it("returns zeros (not NaN) when no events exist", async () => {
		setupSelect([]);

		const result = await countDeliveriesInWindow({ from: new Date(0), to: new Date(1) });

		expect(result).toEqual({ attempts: 0, successes: 0 });
	});
});
