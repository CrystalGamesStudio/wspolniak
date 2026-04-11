import { createUser, findUserByTokenHash } from "./queries";
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

describe("findUserByTokenHash", () => {
	it("returns user for valid token hash", async () => {
		const user = {
			id: "user-1",
			name: "Tomek",
			role: "admin",
			tokenHash: "abc123hash",
			deletedAt: null,
			createdAt: new Date(),
		};
		const mockWhere = vi.fn().mockResolvedValue([user]);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await findUserByTokenHash("abc123hash");

		expect(result).toEqual(user);
	});

	it("returns null for unknown token hash", async () => {
		const mockWhere = vi.fn().mockResolvedValue([]);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await findUserByTokenHash("unknown-hash");

		expect(result).toBeNull();
	});

	it("returns null for soft-deleted user", async () => {
		const mockWhere = vi.fn().mockResolvedValue([]);
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await findUserByTokenHash("deleted-user-hash");

		expect(result).toBeNull();
	});
});
