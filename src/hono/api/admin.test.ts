// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
	createMember: vi.fn(),
	listActiveMembers: vi.fn(),
	regenerateMemberToken: vi.fn(),
	softDeleteMember: vi.fn(),
}));

vi.mock("@/db/instance/queries", () => ({
	getShareCode: vi.fn(),
	setShareCode: vi.fn(),
}));

import {
	createMember,
	findActiveUserById,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { getShareCode, setShareCode } from "@/db/instance/queries";
import adminEndpoint from "./admin";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockCreateMember = vi.mocked(createMember);
const mockListActiveMembers = vi.mocked(listActiveMembers);
const mockRegenerateMemberToken = vi.mocked(regenerateMemberToken);
const mockSoftDeleteMember = vi.mocked(softDeleteMember);
const mockGetShareCode = vi.mocked(getShareCode);
const mockSetShareCode = vi.mocked(setShareCode);

function createApi() {
	const api = new Hono<{ Bindings: { SESSION_SECRET: string } }>().basePath("/api");
	api.route("/admin", adminEndpoint);
	return api;
}

function adminHeaders() {
	return { Cookie: "session=valid-jwt" };
}

beforeEach(() => {
	vi.clearAllMocks();
	mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "admin" });
	mockFindUser.mockResolvedValue({
		id: "u1",
		name: "Tomek",
		role: "admin",
		tokenHash: "hash",
		deletedAt: null,
		note: null,
		createdAt: new Date(),
	});
});

describe("POST /api/admin/members", () => {
	it("creates a member and returns the magic link", async () => {
		mockCreateMember.mockResolvedValue({
			user: {
				id: "m1",
				name: "Kasia",
				role: "member",
				tokenHash: "hash",
				deletedAt: null,
				note: null,
				createdAt: new Date(),
			},
			plaintextToken: "raw-token",
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/members",
			{
				method: "POST",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Kasia" }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			data: { user: { id: string; name: string }; magicLink: string };
		};
		expect(body.data.user.name).toBe("Kasia");
		expect(body.data.magicLink).toContain("raw-token");
		expect(mockCreateMember).toHaveBeenCalledWith("Kasia");
	});

	it("returns 400 when name is missing", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/members",
			{
				method: "POST",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({}),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
	});
});

describe("GET /api/admin/members", () => {
	it("returns list of active members", async () => {
		const members = [
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
		];
		mockListActiveMembers.mockResolvedValue(members);

		const api = createApi();
		const res = await api.request(
			"/api/admin/members",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string; name: string; role: string }[] };
		expect(body.data).toHaveLength(2);
		expect(body.data[0]?.name).toBe("Tomek");
	});
});

describe("POST /api/admin/members/:id/regenerate", () => {
	it("regenerates token and returns new magic link", async () => {
		mockRegenerateMemberToken.mockResolvedValue({ plaintextToken: "new-token" });

		const api = createApi();
		const res = await api.request(
			"/api/admin/members/m1/regenerate",
			{
				method: "POST",
				headers: adminHeaders(),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { magicLink: string } };
		expect(body.data.magicLink).toContain("new-token");
		expect(mockRegenerateMemberToken).toHaveBeenCalledWith("m1");
	});
});

describe("DELETE /api/admin/members/:id", () => {
	it("soft-deletes a member", async () => {
		mockSoftDeleteMember.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/admin/members/m1",
			{
				method: "DELETE",
				headers: adminHeaders(),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);
		expect(mockSoftDeleteMember).toHaveBeenCalledWith("m1");
	});
});

describe("admin authorization", () => {
	it("returns 403 for non-admin member on all admin endpoints", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Kasia", role: "member" });
		mockFindUser.mockResolvedValue({
			id: "u2",
			name: "Kasia",
			role: "member",
			tokenHash: "hash",
			deletedAt: null,
			note: null,
			createdAt: new Date(),
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/members",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Forbidden");
	});
});

describe("GET /api/admin/share-code", () => {
	it("returns current share code", async () => {
		mockGetShareCode.mockResolvedValue("7843");

		const api = createApi();
		const res = await api.request(
			"/api/admin/share-code",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { code: string | null } };
		expect(body.data.code).toBe("7843");
	});
});

describe("PUT /api/admin/share-code", () => {
	it("updates share code", async () => {
		mockSetShareCode.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/admin/share-code",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ code: "9999" }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		expect(mockSetShareCode).toHaveBeenCalledWith("9999");
	});

	it("returns 400 when code is empty", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/share-code",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ code: "" }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
	});

	it("returns 400 when code exceeds 20 characters", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/share-code",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ code: "a".repeat(21) }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
	});
});
