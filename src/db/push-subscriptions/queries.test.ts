// SPDX-License-Identifier: AGPL-3.0-or-later
import { saveSubscription } from "./queries";
import { pushSubscriptions } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

function setupDbMocks() {
	const deleteWhere = vi.fn().mockResolvedValue([]);
	const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
	const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere, from: deleteFrom });

	const returning = vi.fn().mockResolvedValue([
		{
			id: "sub-id",
			userId: "user-1",
			endpoint: "https://web.push.apple.com/new-endpoint",
			p256dh: "p1",
			auth: "a1",
			createdAt: new Date(),
		},
	]);
	const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
	const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
	const insert = vi.fn().mockReturnValue({ values });

	mockGetDb.mockReturnValue({ delete: deleteFn, insert } as never);

	return { deleteFn, deleteWhere, insert, values, onConflictDoUpdate, returning };
}

describe("saveSubscription", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deletes any existing subscriptions for the same user before inserting (avoids stale duplicates)", async () => {
		const mocks = setupDbMocks();

		await saveSubscription({
			userId: "user-1",
			endpoint: "https://web.push.apple.com/new-endpoint",
			p256dh: "p1",
			auth: "a1",
		});

		expect(mocks.deleteFn).toHaveBeenCalledWith(pushSubscriptions);
		expect(mocks.deleteWhere).toHaveBeenCalled();
		expect(mocks.insert).toHaveBeenCalledWith(pushSubscriptions);

		// Order matters: delete must complete before insert so the user isn't
		// briefly without any subscription if both are running concurrently.
		const deleteCallOrder = mocks.deleteFn.mock.invocationCallOrder[0] ?? Infinity;
		const insertCallOrder = mocks.insert.mock.invocationCallOrder[0] ?? -1;
		expect(deleteCallOrder).toBeLessThan(insertCallOrder);
	});

	it("returns the inserted/updated subscription row", async () => {
		setupDbMocks();

		const result = await saveSubscription({
			userId: "user-1",
			endpoint: "https://web.push.apple.com/new-endpoint",
			p256dh: "p1",
			auth: "a1",
		});

		expect(result.endpoint).toBe("https://web.push.apple.com/new-endpoint");
		expect(result.userId).toBe("user-1");
	});
});
