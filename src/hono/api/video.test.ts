// SPDX-License-Identifier: AGPL-3.0-or-later
import { Hono } from "hono";
import type { SessionPayload } from "@/db/identity/session";

vi.mock("@/db/identity/session", () => ({
	verifySessionCookie: vi.fn(),
	SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/db/identity/queries", () => ({
	findActiveUserById: vi.fn(),
}));

vi.mock("@/core/youtube", () => ({
	buildAuthorizationUrl: vi.fn(),
	createState: vi.fn(),
	verifyState: vi.fn(),
	exchangeCodeForTokens: vi.fn(),
	fetchOwnChannel: vi.fn(),
	importEncryptionKey: vi.fn(),
	encryptRefreshToken: vi.fn(),
}));

vi.mock("@/db/instance", () => ({
	getYoutubeConnection: vi.fn(),
	setYoutubeConnection: vi.fn(),
	clearYoutubeConnection: vi.fn(),
}));

import {
	buildAuthorizationUrl,
	createState,
	encryptRefreshToken,
	exchangeCodeForTokens,
	fetchOwnChannel,
	importEncryptionKey,
	verifyState,
} from "@/core/youtube";
import { findActiveUserById } from "@/db/identity/queries";
import { verifySessionCookie } from "@/db/identity/session";
import { clearYoutubeConnection, getYoutubeConnection, setYoutubeConnection } from "@/db/instance";
import videoEndpoint from "./video";

const mockVerify = vi.mocked(verifySessionCookie);
const mockFindUser = vi.mocked(findActiveUserById);
const mockCreateState = vi.mocked(createState);
const mockBuildAuthUrl = vi.mocked(buildAuthorizationUrl);
const mockVerifyState = vi.mocked(verifyState);
const mockExchange = vi.mocked(exchangeCodeForTokens);
const mockFetchChannel = vi.mocked(fetchOwnChannel);
const mockImportKey = vi.mocked(importEncryptionKey);
const mockEncrypt = vi.mocked(encryptRefreshToken);
const mockGetConnection = vi.mocked(getYoutubeConnection);
const mockSet = vi.mocked(setYoutubeConnection);
const mockClear = vi.mocked(clearYoutubeConnection);

const ENV = {
	SESSION_SECRET: "secret",
	APP_URL: "https://wspolniak.test",
	YOUTUBE_CLIENT_ID: "client-123",
	YOUTUBE_CLIENT_SECRET: "secret-456",
	YOUTUBE_TOKEN_ENCRYPTION_KEY: "enc-key",
} as unknown as Env;

function createApi() {
	return new Hono<{ Bindings: Env }>().basePath("/api").route("/video", videoEndpoint);
}

function adminHeaders() {
	return { Cookie: "session=valid-jwt" };
}

function adminSession() {
	mockVerify.mockResolvedValue({ userId: "u1", name: "Tomek", role: "admin" });
	mockFindUser.mockResolvedValue({
		id: "u1",
		name: "Tomek",
		role: "admin",
		tokenHash: "hash",
		deletedAt: null,
		createdAt: new Date(),
	});
}

function memberSession() {
	const member: SessionPayload = { userId: "u2", name: "Kasia", role: "member" };
	mockVerify.mockResolvedValue(member);
	mockFindUser.mockResolvedValue({
		id: "u2",
		name: "Kasia",
		role: "member",
		tokenHash: "hash",
		deletedAt: null,
		createdAt: new Date(),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	adminSession();
});

describe("GET /api/video/connection", () => {
	it("returns the connection status", async () => {
		mockGetConnection.mockResolvedValue({
			connected: true,
			channelId: "UC1",
			channelTitle: "Wspólniak Wideo",
			connectedAt: new Date(),
			connectedBy: "u1",
		});

		const api = createApi();
		const res = await api.request("/api/video/connection", { headers: adminHeaders() }, ENV);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { connected: boolean; channelTitle: string } };
		expect(body.data.connected).toBe(true);
		expect(body.data.channelTitle).toBe("Wspólniak Wideo");
	});

	it("returns 403 for a non-admin member", async () => {
		memberSession();
		const api = createApi();
		const res = await api.request("/api/video/connection", { headers: adminHeaders() }, ENV);

		expect(res.status).toBe(403);
		expect(mockGetConnection).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/video/connection", () => {
	it("clears the connection and returns ok", async () => {
		mockClear.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/video/connection",
			{
				method: "DELETE",
				headers: adminHeaders(),
			},
			ENV,
		);

		expect(res.status).toBe(200);
		expect(mockClear).toHaveBeenCalledOnce();
		const body = (await res.json()) as { data: { ok: boolean } };
		expect(body.data.ok).toBe(true);
	});

	it("returns 403 for a non-admin member", async () => {
		memberSession();
		const api = createApi();
		const res = await api.request(
			"/api/video/connection",
			{
				method: "DELETE",
				headers: adminHeaders(),
			},
			ENV,
		);

		expect(res.status).toBe(403);
		expect(mockClear).not.toHaveBeenCalled();
	});
});

describe("GET /api/video/oauth/start", () => {
	it("redirects to the Google consent URL with a signed state", async () => {
		mockCreateState.mockResolvedValue("signed-state");
		mockBuildAuthUrl.mockReturnValue(
			"https://accounts.google.com/o/oauth2/v2/auth?state=signed-state",
		);

		const api = createApi();
		const res = await api.request("/api/video/oauth/start", { headers: adminHeaders() }, ENV);

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("https://accounts.google.com");
		// state is bound to the admin who started the flow
		expect(mockCreateState).toHaveBeenCalledWith(
			"u1",
			expect.objectContaining({ clientId: "client-123" }),
		);
		expect(mockBuildAuthUrl).toHaveBeenCalledWith(
			"signed-state",
			expect.objectContaining({ clientId: "client-123" }),
		);
	});

	it("returns 503 when YouTube env is not configured", async () => {
		const noYoutube = {
			SESSION_SECRET: "secret",
			APP_URL: "https://wspolniak.test",
		} as unknown as Env;

		const api = createApi();
		const res = await api.request("/api/video/oauth/start", { headers: adminHeaders() }, noYoutube);

		expect(res.status).toBe(503);
		expect(mockCreateState).not.toHaveBeenCalled();
	});

	it("uses the YOUTUBE_REDIRECT_URI override when set", async () => {
		mockCreateState.mockResolvedValue("s");
		mockBuildAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth");
		const envWithRedirect = {
			...ENV,
			YOUTUBE_REDIRECT_URI: "http://localhost:3000/api/video/oauth/callback",
		} as unknown as Env;

		const api = createApi();
		await api.request("/api/video/oauth/start", { headers: adminHeaders() }, envWithRedirect);

		expect(mockBuildAuthUrl).toHaveBeenCalledWith(
			"s",
			expect.objectContaining({
				redirectUri: "http://localhost:3000/api/video/oauth/callback",
			}),
		);
	});

	it("returns 403 for a non-admin member", async () => {
		memberSession();
		const api = createApi();
		const res = await api.request("/api/video/oauth/start", { headers: adminHeaders() }, ENV);

		expect(res.status).toBe(403);
	});
});

describe("GET /api/video/oauth/callback", () => {
	it("exchanges, encrypts, stores the connection and redirects to the admin panel", async () => {
		mockVerifyState.mockResolvedValue({ adminUserId: "u1" });
		mockExchange.mockResolvedValue({
			accessToken: "ya29.access",
			refreshToken: "1//refresh",
			expiresIn: 3600,
		});
		mockFetchChannel.mockResolvedValue({ id: "UC1", title: "Wspólniak Wideo" });
		mockImportKey.mockResolvedValue("crypto-key" as unknown as CryptoKey);
		mockEncrypt.mockResolvedValue("enc-blob");
		mockSet.mockResolvedValue(undefined);

		const api = createApi();
		const res = await api.request(
			"/api/video/oauth/callback?code=the-code&state=the-state",
			{ headers: adminHeaders() },
			ENV,
		);

		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/app/admin");
		expect(res.headers.get("location")).toContain("youtube=connected");

		expect(mockExchange).toHaveBeenCalledWith("the-code", expect.any(Object));
		expect(mockFetchChannel).toHaveBeenCalledWith("ya29.access", expect.any(Object));
		expect(mockEncrypt).toHaveBeenCalledWith("1//refresh", "crypto-key");
		expect(mockSet).toHaveBeenCalledWith({
			channelId: "UC1",
			channelTitle: "Wspólniak Wideo",
			encryptedRefreshToken: "enc-blob",
			connectedBy: "u1",
		});
	});

	it("returns 400 when the state is invalid (CSRF)", async () => {
		mockVerifyState.mockResolvedValue(null);

		const api = createApi();
		const res = await api.request(
			"/api/video/oauth/callback?code=c&state=bad",
			{ headers: adminHeaders() },
			ENV,
		);

		expect(res.status).toBe(400);
		expect(mockExchange).not.toHaveBeenCalled();
		expect(mockSet).not.toHaveBeenCalled();
	});

	it("returns 400 when the code is missing", async () => {
		const api = createApi();
		const res = await api.request(
			"/api/video/oauth/callback?state=s",
			{ headers: adminHeaders() },
			ENV,
		);

		expect(res.status).toBe(400);
		expect(mockExchange).not.toHaveBeenCalled();
	});

	it("returns 403 for a non-admin member", async () => {
		memberSession();
		const api = createApi();
		const res = await api.request(
			"/api/video/oauth/callback?code=c&state=s",
			{ headers: adminHeaders() },
			ENV,
		);

		expect(res.status).toBe(403);
		expect(mockExchange).not.toHaveBeenCalled();
	});
});
