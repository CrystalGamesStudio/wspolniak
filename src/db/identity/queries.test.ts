// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	createMember,
	createUser,
	findUserByTokenHash,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "./queries";
import { users } from "./table";

vi.mock("@/db/setup", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/db/identity/crypto", () => ({
	generateToken: vi.fn(),
}));

import { generateToken } from "@/db/identity/crypto";
import { getDb } from "@/db/setup";

const mockGenerateToken = vi.mocked(generateToken);

const mockGetDb = vi.mocked(getDb);

describe("createMember", () => {
	it("creates a user with role 'member' and returns plaintext token", async () => {
		mockGenerateToken.mockResolvedValue({ plaintext: "raw-token", hash: "hashed-token" });
		const mockReturning = vi.fn().mockResolvedValue([
			{
				id: "member-id",
				name: "Kasia",
				role: "member",
				tokenHash: "hashed-token",
				deletedAt: null,
				createdAt: new Date(),
			},
		]);
		const mockInsert = vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({ returning: mockReturning }),
		});
		mockGetDb.mockReturnValue({ insert: mockInsert } as never);

		const result = await createMember("Kasia");

		expect(mockGenerateToken).toHaveBeenCalled();
		expect(mockInsert).toHaveBeenCalledWith(users);
		expect(result.user.name).toBe("Kasia");
		expect(result.user.role).toBe("member");
		expect(result.plaintextToken).toBe("raw-token");
	});
});

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
		const mockOrderBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await findUserByTokenHash("unknown-hash");

		expect(result).toBeNull();
	});

	it("returns null for soft-deleted user", async () => {
		const mockOrderBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await findUserByTokenHash("deleted-user-hash");

		expect(result).toBeNull();
	});
});

describe("listActiveMembers", () => {
	it("returns only non-deleted users", async () => {
		const activeUsers = [
			{
				id: "u1",
				name: "Tomek",
				role: "admin",
				tokenHash: "h1",
				deletedAt: null,
				createdAt: new Date(),
			},
			{
				id: "u2",
				name: "Kasia",
				role: "member",
				tokenHash: "h2",
				deletedAt: null,
				createdAt: new Date(),
			},
		];
		const mockOrderBy = vi.fn().mockResolvedValue(activeUsers);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await listActiveMembers();

		expect(result).toEqual(activeUsers);
		expect(result).toHaveLength(2);
	});

	it("returns empty array when no active users exist", async () => {
		const mockOrderBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
		mockGetDb.mockReturnValue({ select: mockSelect } as never);

		const result = await listActiveMembers();

		expect(result).toEqual([]);
	});
});

describe("regenerateMemberToken", () => {
	it("generates a new token and updates the user's tokenHash", async () => {
		mockGenerateToken.mockResolvedValue({ plaintext: "new-token", hash: "new-hash" });
		const mockWhere = vi.fn().mockResolvedValue([
			{
				id: "u2",
				name: "Kasia",
				role: "member",
				tokenHash: "new-hash",
				deletedAt: null,
				createdAt: new Date(),
			},
		]);
		const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
		const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
		mockGetDb.mockReturnValue({ update: mockUpdate } as never);

		const result = await regenerateMemberToken("u2");

		expect(mockGenerateToken).toHaveBeenCalled();
		expect(mockUpdate).toHaveBeenCalledWith(users);
		expect(result.plaintextToken).toBe("new-token");
	});
});

describe("softDeleteMember", () => {
	it("sets deletedAt timestamp on the user", async () => {
		const mockOrderBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
		const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
		mockGetDb.mockReturnValue({ update: mockUpdate } as never);

		await softDeleteMember("u2");

		expect(mockUpdate).toHaveBeenCalledWith(users);
		expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
	});
});
