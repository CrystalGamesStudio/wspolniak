// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SessionPayload } from "@/db/identity/session";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: vi.fn(),
}));

import { getCookie } from "@tanstack/react-start/server";
import { verifySessionCookie } from "@/db/identity/session";
import { getSessionUser } from "./auth";

const mockGetCookie = vi.mocked(getCookie);
const mockVerify = vi.mocked(verifySessionCookie);

describe("getSessionUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns user payload when session cookie is valid", async () => {
		const payload: SessionPayload = { userId: "u1", name: "Tomek", role: "admin" };
		mockGetCookie.mockReturnValue("valid-jwt");
		mockVerify.mockResolvedValue(payload);

		const result = await getSessionUser("test-secret");

		expect(result).toEqual(payload);
		expect(mockGetCookie).toHaveBeenCalledWith("session");
		expect(mockVerify).toHaveBeenCalledWith("valid-jwt", "test-secret");
	});

	it("returns null when no session cookie exists", async () => {
		mockGetCookie.mockReturnValue(undefined);

		const result = await getSessionUser("test-secret");

		expect(result).toBeNull();
		expect(mockVerify).not.toHaveBeenCalled();
	});

	it("returns null when session cookie is invalid", async () => {
		mockGetCookie.mockReturnValue("bad-jwt");
		mockVerify.mockResolvedValue(null);

		const result = await getSessionUser("test-secret");

		expect(result).toBeNull();
	});
});
