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
	getMaintenanceConfig: vi.fn(),
	updateMaintenance: vi.fn(),
}));

vi.mock("@/db/stats", () => ({
	getStatsSummary: vi.fn(),
}));

import {
	createMember,
	findActiveUserById,
	listActiveMembers,
	regenerateMemberToken,
	softDeleteMember,
} from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { getMaintenanceConfig, updateMaintenance } from "@/db/instance/queries";
import { getStatsSummary } from "@/db/stats";
import adminEndpoint from "./admin";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockCreateMember = vi.mocked(createMember);
const mockListActiveMembers = vi.mocked(listActiveMembers);
const mockRegenerateMemberToken = vi.mocked(regenerateMemberToken);
const mockSoftDeleteMember = vi.mocked(softDeleteMember);
const mockGetMaintenanceConfig = vi.mocked(getMaintenanceConfig);
const mockUpdateMaintenance = vi.mocked(updateMaintenance);
const mockGetStatsSummary = vi.mocked(getStatsSummary);

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
		mockFindUser.mockResolvedValue({
			id: "u2",
			name: "Kasia",
			role: "member",
			tokenHash: "hash",
			deletedAt: null,
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

describe("GET /api/admin/maintenance", () => {
	it("returns current maintenance config", async () => {
		mockGetMaintenanceConfig.mockResolvedValue({
			enabled: true,
			message: "Naprawa",
			subtitle: "Wróć",
			icon: "wrench",
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { enabled: boolean; message: string; subtitle: string; icon: string };
		};
		expect(body.data).toEqual({
			enabled: true,
			message: "Naprawa",
			subtitle: "Wróć",
			icon: "wrench",
		});
	});
});

describe("PUT /api/admin/maintenance", () => {
	it("updates all fields and returns the new config", async () => {
		mockGetMaintenanceConfig.mockResolvedValue({
			enabled: true,
			message: "X",
			subtitle: "Y",
			icon: "wrench",
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true, message: "X", subtitle: "Y", icon: "wrench" }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		expect(mockUpdateMaintenance).toHaveBeenCalledWith({
			enabled: true,
			message: "X",
			subtitle: "Y",
			icon: "wrench",
		});
	});

	it("trims and forwards partial update (only enabled)", async () => {
		mockGetMaintenanceConfig.mockResolvedValue({
			enabled: true,
			message: "Wspólniak jest w trakcie naprawy",
			subtitle: "Wróć za chwilę",
			icon: "alert-triangle",
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		expect(mockUpdateMaintenance).toHaveBeenCalledWith({ enabled: true });
	});

	it("rejects message longer than 200 characters", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ message: "a".repeat(201) }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
		expect(mockUpdateMaintenance).not.toHaveBeenCalled();
	});

	it("rejects subtitle longer than 100 characters", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ subtitle: "a".repeat(101) }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
	});

	it("rejects icon longer than 50 characters", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/admin/maintenance",
			{
				method: "PUT",
				headers: { ...adminHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ icon: "a".repeat(51) }),
			},
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(400);
	});
});

describe("GET /api/admin/stats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "admin" });
		mockFindUser.mockResolvedValue({
			id: "u1",
			name: "Tomek",
			role: "admin",
			tokenHash: "hash",
			deletedAt: null,
			createdAt: new Date(),
		});
	});

	it("returns the stats summary", async () => {
		const summary = {
			dau: 3,
			wau: 5,
			photosLast7Days: 12,
			pushDeliveryLast7Days: { attempts: 10, successes: 8, rate: 0.8 },
			totalPosts: 150,
			totalComments: 800,
			totalPhotos: 320,
			totalReactions: 1240,
			totalMentions: 95,
			windowStart: "2026-06-30T12:00:00.000Z",
			windowEnd: "2026-07-07T12:00:00.000Z",
		};
		mockGetStatsSummary.mockResolvedValue(summary);

		const api = createApi();
		const res = await api.request(
			"/api/admin/stats",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: typeof summary };
		expect(body.data).toEqual(summary);
	});

	it("returns 403 for a non-admin member", async () => {
		mockVerify.mockResolvedValue({ userId: "u2", name: "Kasia", role: "member" });
		mockFindUser.mockResolvedValue({
			id: "u2",
			name: "Kasia",
			role: "member",
			tokenHash: "hash",
			deletedAt: null,
			createdAt: new Date(),
		});

		const api = createApi();
		const res = await api.request(
			"/api/admin/stats",
			{ headers: adminHeaders() },
			{ SESSION_SECRET: "secret" },
		);

		expect(res.status).toBe(403);
	});
});
