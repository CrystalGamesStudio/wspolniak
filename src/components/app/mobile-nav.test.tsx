// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { MobileNav } from "./mobile-nav";

// Sterowana ścieżka routera — granica systemu (zewnętrzny framework).
let currentPathname = "/app";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, className, children, ...rest }: ComponentProps<"a"> & { to: string }) => (
		<a href={to} className={className} {...rest}>
			{children}
		</a>
	),
	useLocation: () => ({ pathname: currentPathname }),
}));

function setPathname(pathname: string) {
	currentPathname = pathname;
}

describe("MobileNav", () => {
	it("renderuje link Home prowadzacy do feedu /app", () => {
		setPathname("/app");
		render(<MobileNav />);

		const homeLink = screen.getByRole("link", { name: /home/i });
		expect(homeLink.getAttribute("href")).toBe("/app");
	});

	it("nie zawiera juz przycisku Feedback", () => {
		setPathname("/app");
		render(<MobileNav />);

		expect(screen.queryByText(/feedback/i)).toBeNull();
	});

	it("podswietla Home gdy uzytkownik jest na feedzie /app", () => {
		setPathname("/app");
		render(<MobileNav />);

		const homeLink = screen.getByRole("link", { name: /home/i });
		expect(homeLink.className).toMatch(/font-bold/);
	});

	it("nie podswietla Home na podstronie feedu (exact match)", () => {
		setPathname("/app/new");
		render(<MobileNav />);

		const homeLink = screen.getByRole("link", { name: /home/i });
		expect(homeLink.className).not.toMatch(/font-bold/);
	});
});
