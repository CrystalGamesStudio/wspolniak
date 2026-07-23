// SPDX-License-Identifier: AGPL-3.0-or-later
import { AppError } from "@/core/errors";
import {
	buildAuthorizationUrl,
	createState,
	exchangeCodeForTokens,
	fetchOwnChannel,
	refreshAccessToken,
	verifyState,
	type YoutubeConfig,
} from "./oauth";

const config: YoutubeConfig = {
	clientId: "client-123",
	clientSecret: "secret-456",
	redirectUri: "https://wspolniak.test/api/video/oauth/callback",
	stateSecret: "state-signing-key",
};

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("buildAuthorizationUrl", () => {
	it("builds a Google consent URL with all required params", () => {
		const url = new URL(buildAuthorizationUrl("the-state", config));

		expect(url.origin).toBe("https://accounts.google.com");
		expect(url.pathname).toBe("/o/oauth2/v2/auth");
		expect(url.searchParams.get("client_id")).toBe("client-123");
		expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("state")).toBe("the-state");
		expect(url.searchParams.get("access_type")).toBe("offline");
		expect(url.searchParams.get("prompt")).toBe("consent");
		// upload scope is needed from day one so we don't force a re-consent later
		expect(url.searchParams.get("scope")).toContain("youtube.upload");
	});
});

describe("exchangeCodeForTokens", () => {
	it("exchanges an auth code for access + refresh tokens", async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse(200, {
				access_token: "ya29.access",
				refresh_token: "1//refresh",
				expires_in: 3600,
				token_type: "Bearer",
			}),
		);

		const tokens = await exchangeCodeForTokens("the-code", config, fetchFn);

		expect(tokens).toEqual({
			accessToken: "ya29.access",
			refreshToken: "1//refresh",
			expiresIn: 3600,
		});
		const [endpoint, init] = fetchFn.mock.calls[0];
		expect(endpoint).toBe("https://oauth2.googleapis.com/token");
		const body = (init as RequestInit).body as string;
		expect(body).toContain("code=the-code");
		expect(body).toContain("grant_type=authorization_code");
		expect(body).toContain("client_id=client-123");
	});

	it("throws AppError when Google rejects the code", async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" }));
		await expect(exchangeCodeForTokens("bad", config, fetchFn)).rejects.toThrow(AppError);
	});
});

describe("refreshAccessToken", () => {
	it("returns a fresh access token from a stored refresh token", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(jsonResponse(200, { access_token: "ya29.new-access", expires_in: 3600 }));

		const result = await refreshAccessToken("1//refresh", config, fetchFn);

		expect(result).toEqual({ accessToken: "ya29.new-access", expiresIn: 3600 });
		const [endpoint, init] = fetchFn.mock.calls[0];
		expect(endpoint).toBe("https://oauth2.googleapis.com/token");
		const body = (init as RequestInit).body as string;
		expect(body).toContain("grant_type=refresh_token");
		expect(body).toContain("refresh_token=1%2F%2Frefresh");
	});

	it("throws AppError when the refresh token is invalid or revoked", async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid_grant" }));
		await expect(refreshAccessToken("bad", config, fetchFn)).rejects.toThrow(AppError);
	});
});

describe("fetchOwnChannel", () => {
	it("returns the channel id and title", async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse(200, {
				items: [{ id: "UC123", snippet: { title: "Wspólniak Wideo" } }],
			}),
		);

		const channel = await fetchOwnChannel("ya29.access", config, fetchFn);

		expect(channel).toEqual({ id: "UC123", title: "Wspólniak Wideo" });
		const url = new URL(fetchFn.mock.calls[0][0] as string);
		expect(url.searchParams.get("mine")).toBe("true");
		expect(url.searchParams.get("part")).toBe("snippet");
	});

	it("throws AppError when the account has no YouTube channel", async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
		await expect(fetchOwnChannel("ya29.access", config, fetchFn)).rejects.toThrow(AppError);
	});

	it("maps a 403 to a typed AppError, never leaking raw details", async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse(403, {
				error: { message: "quotaExceeded", errors: [{ reason: "quotaExceeded" }] },
			}),
		);
		await expect(fetchOwnChannel("ya29.access", config, fetchFn)).rejects.toThrow(AppError);
	});
});

describe("OAuth state (CSRF)", () => {
	it("round-trips adminUserId through a signed state", async () => {
		const state = await createState("admin-1", config);
		expect(await verifyState(state, config)).toEqual({ adminUserId: "admin-1" });
	});

	it("rejects a tampered state", async () => {
		const state = await createState("admin-1", config);
		const tampered = state.slice(0, -1) + (state.endsWith("A") ? "B" : "A");
		expect(await verifyState(tampered, config)).toBeNull();
	});

	it("rejects a state signed with a different secret", async () => {
		const state = await createState("admin-1", config);
		const other = { ...config, stateSecret: "different-key" };
		expect(await verifyState(state, other)).toBeNull();
	});
});
