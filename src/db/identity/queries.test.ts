import { createUser } from "./queries";
import { users } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "@/db/setup";

const mockGetDb = vi.mocked(getDb);

describe("createUser", () => {
	it("inserts a user with name, role, and tokenHash", async () => {
		const mockReturning = vi.fn().mockResolvedValue([
			{
				id: "user-id",
				name: "Tomek",
				role: "admin",
				tokenHash: "abc123hash",
				deletedAt: null,
				createdAt: new Date(),
			},
		]);
		const mockInsert = vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({ returning: mockReturning }),
		});
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createUser({
			name: "Tomek",
			role: "admin",
			tokenHash: "abc123hash",
		});

		expect(mockInsert).toHaveBeenCalledWith(users);
		expect(result.name).toBe("Tomek");
		expect(result.role).toBe("admin");
		expect(result.tokenHash).toBe("abc123hash");
	});
});
