// SPDX-License-Identifier: AGPL-3.0-or-later
vi.mock("@/db/instance/queries", () => ({
	getShareCode: vi.fn(),
	setShareCode: vi.fn(),
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
	listActiveMembers: vi.fn(),
	regenerateMemberToken: vi.fn(),
}));

import { Hono } from "hono";
import {
	findActiveUserById,
	listActiveMembers,
	regenerateMemberToken,
} from "@/db/identity/queries";
import { getShareCode } from "@/db/instance/queries";
import shareEndpoint from "./share";

const mockGetShareCode = vi.mocked(getShareCode);
const mockListActiveMembers = vi.mocked(listActiveMembers);
const mockFindActiveUserById = vi.mocked(findActiveUserById);
const mockRegenerateMemberToken = vi.mocked(regenerateMemberToken);

function createApi() {
	const api = new Hono().basePath("/api");
	api.route("/share", shareEndpoint);
	return api;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/share/verify", () => {
	it("returns member list (no admin) when code matches", async () => {
		mockGetShareCode.mockResolvedValue("7843");
		mockListActiveMembers.mockResolvedValue([
			{
				id: "u1",
				name: "Tomek",
				role: "admin",
				tokenHash: "h1",
				deletedAt: null,
				note: null,
				createdAt: new Date(),
			},
			{
				id: "u2",
				name: "Kasia",
				role: "member",
				tokenHash: "h2",
				deletedAt: null,
				note: null,
				createdAt: new Date(),
			},
		]);

		const res = await createApi().request("/api/share/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "7843" }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			members: { id: string; name: string }[];
		};
		expect(body.members).toHaveLength(1);
		expect(body.members[0]?.name).toBe("Kasia");
		expect(body.members[0]?.id).toBe("u2");
	});

	it("returns 401 when code does not match", async () => {
		mockGetShareCode.mockResolvedValue("7843");

		const res = await createApi().request("/api/share/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "wrong" }),
		});

		expect(res.status).toBe(401);
	});

	it("returns 401 when shareCode is not set (null)", async () => {
		mockGetShareCode.mockResolvedValue(null);

		const res = await createApi().request("/api/share/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "7843" }),
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/share/login", () => {
	it("returns redirect URL for valid code and member", async () => {
		mockGetShareCode.mockResolvedValue("7843");
		mockFindActiveUserById.mockResolvedValue({
			id: "u2",
			name: "Kasia",
			role: "member",
			tokenHash: "old-hash",
			deletedAt: null,
			note: null,
			createdAt: new Date(),
		});
		mockRegenerateMemberToken.mockResolvedValue({ plaintextToken: "new-token" });

		const res = await createApi().request("/api/share/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "7843", memberId: "u2" }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { redirectUrl: string };
		expect(body.redirectUrl).toBe("/app/u/new-token");
		expect(mockRegenerateMemberToken).toHaveBeenCalledWith("u2");
	});

	it("returns 403 when user is admin", async () => {
		mockGetShareCode.mockResolvedValue("7843");
		mockFindActiveUserById.mockResolvedValue({
			id: "u1",
			name: "Tomek",
			role: "admin",
			tokenHash: "h1",
			deletedAt: null,
			note: null,
			createdAt: new Date(),
		});

		const res = await createApi().request("/api/share/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "7843", memberId: "u1" }),
		});

		expect(res.status).toBe(403);
	});

	it("returns 404 when member is deleted", async () => {
		mockGetShareCode.mockResolvedValue("7843");
		mockFindActiveUserById.mockResolvedValue(null);

		const res = await createApi().request("/api/share/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "7843", memberId: "deleted-id" }),
		});

		expect(res.status).toBe(404);
	});
});
