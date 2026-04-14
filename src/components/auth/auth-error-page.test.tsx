// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { AuthErrorPage } from "./auth-error-page";

describe("AuthErrorPage", () => {
	it("renders Polish error message about invalid token", () => {
		render(<AuthErrorPage />);

		expect(screen.getByText("Link jest nieaktywny lub nieprawidłowy")).toBeDefined();
	});

	it("renders instruction to ask admin for a new link", () => {
		render(<AuthErrorPage />);

		expect(screen.getByText("Poproś admina o nowy link")).toBeDefined();
	});
});
