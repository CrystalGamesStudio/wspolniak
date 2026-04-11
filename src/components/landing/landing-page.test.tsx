import { render, screen } from "@testing-library/react";
import { LandingPage } from "./landing-page";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

describe("LandingPage", () => {
	it("renders project name", () => {
		render(<LandingPage />);

		expect(screen.getByText("Wspólniak")).toBeDefined();
	});

	it("renders Polish description about family photo sharing", () => {
		render(<LandingPage />);

		expect(screen.getByText(/prywatne udostępnianie zdjęć/i)).toBeDefined();
	});

	it("renders GitHub link", () => {
		render(<LandingPage />);

		const link = screen.getByRole("link", { name: /github/i });
		expect(link).toBeDefined();
	});

	it("renders deploy CTA when not authenticated", () => {
		render(<LandingPage />);

		expect(screen.getByRole("link", { name: /deploy to cloudflare/i })).toBeDefined();
		expect(screen.queryByText(/przejdź do aplikacji/i)).toBeNull();
	});

	it("renders 'go to app' button when authenticated", () => {
		render(<LandingPage isAuthenticated />);

		expect(screen.getByText(/przejdź do aplikacji/i)).toBeDefined();
		expect(screen.queryByRole("link", { name: /deploy to cloudflare/i })).toBeNull();
	});

	it("renders 'how it works' section with 3 steps", () => {
		render(<LandingPage />);

		expect(screen.getByText("Jak to działa?")).toBeDefined();
		expect(screen.getByText("Wdróż instancję")).toBeDefined();
		expect(screen.getByText("Skonfiguruj rodzinę")).toBeDefined();
		expect(screen.getByText("Zaproś bliskich")).toBeDefined();
	});

	it("renders features section", () => {
		render(<LandingPage />);

		expect(screen.getByText("Dlaczego Wspólniak?")).toBeDefined();
		expect(screen.getByText("Pełna prywatność")).toBeDefined();
		expect(screen.getByText("Dla całej rodziny")).toBeDefined();
	});
});
