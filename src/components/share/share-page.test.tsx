// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { SharePage } from "./share-page";

function renderWithProviders(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SharePage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("pre-fills the code input when initialCode prop is provided", () => {
		renderWithProviders(<SharePage initialCode="7843" />);

		const input = screen.getByLabelText("Kod dostępu") as HTMLInputElement;
		expect(input.value).toBe("7843");
	});

	it("after auto-verify, shows a primary CTA labelled with the preselected member's name", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					members: [
						{ id: "u2", name: "Kasia" },
						{ id: "u3", name: "Anna" },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		renderWithProviders(<SharePage initialCode="7843" preselectedMemberId="u3" />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: /Zaloguj się jako Anna/i })).toBeDefined();
		});
	});

	it("falls back to standard list when preselectedMemberId is not in returned members", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					members: [
						{ id: "u2", name: "Kasia" },
						{ id: "u3", name: "Anna" },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		renderWithProviders(<SharePage initialCode="7843" preselectedMemberId="ghost" />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Kasia" })).toBeDefined();
		});
		expect(screen.getByRole("button", { name: "Anna" })).toBeDefined();
		expect(screen.queryByRole("button", { name: /Zaloguj się jako/i })).toBeNull();
	});

	it("auto-verifies on mount when both initialCode and preselectedMemberId are provided", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					members: [
						{ id: "u2", name: "Kasia" },
						{ id: "u3", name: "Anna" },
					],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		renderWithProviders(<SharePage initialCode="7843" preselectedMemberId="u3" />);

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalledWith(
				"/api/share/verify",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ code: "7843" }),
				}),
			);
		});
	});
});
