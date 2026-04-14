// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	createMember: vi.fn(),
	listActiveMembers: vi.fn(),
	regenerateMemberToken: vi.fn(),
	softDeleteMember: vi.fn(),
}));

import {
	createMember,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import adminEndpoint from "./admin";

const mockVerify = vi.mocked(verifySessionCookie);
const mockCreateMember = vi.mocked(createMember);
const mockListActiveMembers = vi.mocked(listActiveMembers);
const mockRegenerateMemberToken = vi.mocked(regenerateMemberToken);
const mockSoftDeleteMember = vi.mocked(softDeleteMember);

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
