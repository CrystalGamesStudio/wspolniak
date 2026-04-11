import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupPage } from "./setup-page";

function renderWithProviders(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("SetupPage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("renders setup form with Polish labels", () => {
		renderWithProviders(<SetupPage />);

		expect(screen.getByLabelText("Nazwa rodziny")).toBeDefined();
		expect(screen.getByLabelText("Imię administratora")).toBeDefined();
		expect(screen.getByRole("button", { name: /skonfiguruj/i })).toBeDefined();
	});

	it("submits form and displays magic link on success", async () => {
		const user = userEvent.setup();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ magicLink: "https://example.com/app/u/abc123" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		renderWithProviders(<SetupPage />);

		await user.type(screen.getByLabelText("Nazwa rodziny"), "Kowalscy");
		await user.type(screen.getByLabelText("Imię administratora"), "Tomek");
		await user.click(screen.getByRole("button", { name: /skonfiguruj/i }));

		await waitFor(() => {
			expect(screen.getByText("https://example.com/app/u/abc123")).toBeDefined();
		});
	});

	it("shows error message when instance is already claimed (404)", async () => {
		const user = userEvent.setup();
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 404 }));

		renderWithProviders(<SetupPage />);

		await user.type(screen.getByLabelText("Nazwa rodziny"), "Kowalscy");
		await user.type(screen.getByLabelText("Imię administratora"), "Tomek");
		await user.click(screen.getByRole("button", { name: /skonfiguruj/i }));

		await waitFor(() => {
			expect(screen.getByText("Instancja już skonfigurowana")).toBeDefined();
		});
	});
});
