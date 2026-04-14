// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { AppPage } from "./app-page";

describe("AppPage", () => {
	it("renders greeting with user name", () => {
		render(<AppPage name="Tomek" />);

		expect(screen.getByText("Witaj Tomek")).toBeDefined();
	});
});
