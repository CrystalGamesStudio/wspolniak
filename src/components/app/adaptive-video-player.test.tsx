// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { AdaptiveVideoPlayer } from "./adaptive-video-player";

describe("AdaptiveVideoPlayer", () => {
	class MockIntersectionObserver {
		callback: IntersectionObserverCallback;
		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();

		constructor(callback: IntersectionObserverCallback) {
			this.callback = callback;
		}

		// Helper to trigger callback in tests
		trigger(isIntersecting: boolean) {
			this.callback(
				[
					{
						isIntersecting,
						target: document.createElement("div"),
					} as unknown as IntersectionObserverEntry,
				],
				this as unknown as IntersectionObserver,
			);
		}
	}

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset Intersection Observer
		global.IntersectionObserver =
			MockIntersectionObserver as unknown as typeof IntersectionObserver;
		// Reset navigator.connection
		Object.defineProperty(window.navigator, "connection", {
			writable: true,
			value: undefined,
		});
		// Reset matchMedia
		global.matchMedia = vi.fn().mockImplementation(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
	});

	it("pokazuje thumbnail gdy canAutoplay=false", () => {
		render(
			<AdaptiveVideoPlayer
				videoUid="stream-123"
				thumbnailUrl="/api/app/videos/stream-123/thumbnail"
				canAutoplay={false}
			/>,
		);

		const thumbnail = screen.getByRole("img", { name: /miniatura wideo/i });
		expect(thumbnail).toBeTruthy();
		expect(thumbnail.getAttribute("src")).toBe("/api/app/videos/stream-123/thumbnail");

		const video = screen.queryByRole("video");
		expect(video).toBeNull();
	});

	it("autoplay muted gdy canAutoplay=true i w viewport", async () => {
		// Track observer instance to trigger intersection
		let observerInstance: MockIntersectionObserver | null = null;

		class TestableIntersectionObserver extends MockIntersectionObserver {
			constructor(callback: IntersectionObserverCallback) {
				super(callback);
				observerInstance = this;
			}
		}

		global.IntersectionObserver =
			TestableIntersectionObserver as unknown as typeof IntersectionObserver;

		const { container } = render(
			<AdaptiveVideoPlayer
				videoUid="stream-123"
				thumbnailUrl="/api/app/videos/stream-123/thumbnail"
				canAutoplay={true}
			/>,
		);

		// Trigger intersection to make element visible
		await act(async () => {
			observerInstance?.trigger(true);
		});

		// Use querySelector instead of findByRole for video element
		const video = container.querySelector("video");
		expect(video).toBeTruthy();
		expect(video).toHaveProperty("muted", true);
		expect(video).toHaveProperty("autoplay", true);

		const thumbnail = screen.queryByRole("img");
		expect(thumbnail).toBeNull();
	});

	it("nie autoplay gdy nie w viewport", async () => {
		// Use base MockIntersectionObserver without triggering intersection
		global.IntersectionObserver =
			MockIntersectionObserver as unknown as typeof IntersectionObserver;

		render(
			<AdaptiveVideoPlayer
				videoUid="stream-123"
				thumbnailUrl="/api/app/videos/stream-123/thumbnail"
				canAutoplay={true}
			/>,
		);

		// Don't trigger intersection, so it stays not intersecting
		// Use alt text to find the thumbnail image, not the SVG icon
		const thumbnail = await screen.findByAltText("Miniatura wideo");
		expect(thumbnail).toBeTruthy();

		const video = screen.queryByRole("video");
		expect(video).toBeNull();
	});

	it("kliknięcie otwiera fullscreen player", async () => {
		const user = userEvent.setup();

		render(
			<AdaptiveVideoPlayer
				videoUid="stream-123"
				thumbnailUrl="/api/app/videos/stream-123/thumbnail"
				canAutoplay={false}
			/>,
		);

		const thumbnail = screen.getByRole("img", { name: /miniatura wideo/i });
		await user.click(thumbnail);

		// Sprawdzamy czy fullscreen player się pojawił
		const fullscreenButton = screen.getByRole("button", { name: /zamknij pełny ekran/i });
		expect(fullscreenButton).toBeTruthy();
	});
});
