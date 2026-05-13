// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderHook } from "@testing-library/react";
import { useVideoAutoplay } from "./use-video-autoplay";

describe("useVideoAutoplay", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset navigator.connection to undefined
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

	it("zwraca canAutoplay=false gdy Network Information API jest niedostępny", () => {
		const { result } = renderHook(() => useVideoAutoplay());

		expect(result.current.canAutoplay).toBe(false);
		expect(result.current.effectiveType).toBeNull();
	});

	it("zwraca canAutoplay=true na połączeniu 4g", () => {
		// Mock navigator.connection z effectiveType '4g'
		const mockConnection = {
			effectiveType: "4g",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		Object.defineProperty(window.navigator, "connection", {
			writable: true,
			value: mockConnection,
		});

		const { result } = renderHook(() => useVideoAutoplay());

		expect(result.current.canAutoplay).toBe(true);
		expect(result.current.effectiveType).toBe("4g");
	});

	it("zwraca canAutoplay=false na połączeniu 3g", () => {
		const mockConnection = {
			effectiveType: "3g",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		Object.defineProperty(window.navigator, "connection", {
			writable: true,
			value: mockConnection,
		});

		const { result } = renderHook(() => useVideoAutoplay());

		expect(result.current.canAutoplay).toBe(false);
		expect(result.current.effectiveType).toBe("3g");
	});

	it("zwraca canAutoplay=false na slow-2g", () => {
		const mockConnection = {
			effectiveType: "slow-2g",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		Object.defineProperty(window.navigator, "connection", {
			writable: true,
			value: mockConnection,
		});

		const { result } = renderHook(() => useVideoAutoplay());

		expect(result.current.canAutoplay).toBe(false);
		expect(result.current.effectiveType).toBe("slow-2g");
	});

	it("respektuje prefers-reduced-motion", () => {
		const mockConnection = {
			effectiveType: "4g",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		Object.defineProperty(window.navigator, "connection", {
			writable: true,
			value: mockConnection,
		});

		// Mock prefers-reduced-motion
		global.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: query === "(prefers-reduced-motion: reduce)",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));

		const { result } = renderHook(() => useVideoAutoplay());

		expect(result.current.canAutoplay).toBe(false);
	});
});
