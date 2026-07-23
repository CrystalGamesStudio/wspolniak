// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YoutubeConnection } from "./youtube-connection";

describe("YoutubeConnection", () => {
	it("shows a Connect link to the OAuth start endpoint when disconnected", () => {
		render(
			<YoutubeConnection
				connection={{ connected: false, channelTitle: null }}
				isDisconnecting={false}
				onDisconnect={vi.fn()}
			/>,
		);

		const link = screen.getByRole("link", { name: /połącz youtube/i });
		expect(link.getAttribute("href")).toBe("/api/video/oauth/start");
	});

	it("shows the channel name and a Disconnect button when connected", () => {
		render(
			<YoutubeConnection
				connection={{ connected: true, channelTitle: "Wspólniak Wideo" }}
				isDisconnecting={false}
				onDisconnect={vi.fn()}
			/>,
		);

		expect(screen.getByText("Wspólniak Wideo")).toBeDefined();
		expect(screen.getByRole("button", { name: /rozłącz/i })).toBeDefined();
		// no Connect link once connected
		expect(screen.queryByRole("link", { name: /połącz youtube/i })).toBeNull();
	});

	it("calls onDisconnect when the Disconnect button is clicked", async () => {
		const user = userEvent.setup();
		const onDisconnect = vi.fn();
		render(
			<YoutubeConnection
				connection={{ connected: true, channelTitle: "X" }}
				isDisconnecting={false}
				onDisconnect={onDisconnect}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /rozłącz/i }));
		expect(onDisconnect).toHaveBeenCalledOnce();
	});

	it("disables the Disconnect button while disconnecting", () => {
		render(
			<YoutubeConnection
				connection={{ connected: true, channelTitle: "X" }}
				isDisconnecting={true}
				onDisconnect={vi.fn()}
			/>,
		);
		expect(screen.getByRole("button", { name: /rozłącz/i })).toHaveProperty("disabled", true);
	});

	it("shows a success banner after a successful OAuth redirect", () => {
		render(
			<YoutubeConnection
				connection={{ connected: true, channelTitle: "X" }}
				isDisconnecting={false}
				onDisconnect={vi.fn()}
				flash="connected"
			/>,
		);
		expect(screen.getByText(/połączono z youtube/i)).toBeDefined();
	});

	it("shows an error banner after a failed OAuth redirect", () => {
		render(
			<YoutubeConnection
				connection={{ connected: false, channelTitle: null }}
				isDisconnecting={false}
				onDisconnect={vi.fn()}
				flash="error"
			/>,
		);
		expect(screen.getByText(/nie udało się połączyć/i)).toBeDefined();
	});
});
