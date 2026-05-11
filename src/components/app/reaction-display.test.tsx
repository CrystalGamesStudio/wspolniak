// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from "@testing-library/react";
import { ReactionDisplay } from "./reaction-display";

describe("ReactionDisplay", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders emoji and count for each non-zero reaction", () => {
		render(<ReactionDisplay counts={{ heart: 8, thumbs_up: 4, laugh: 3 }} />);

		expect(screen.getByText(/8/)).toBeDefined();
		expect(screen.getByText(/4/)).toBeDefined();
		expect(screen.getByText(/3/)).toBeDefined();
	});

	it("hides reaction types with count of 0", () => {
		render(<ReactionDisplay counts={{ heart: 5, thumbs_up: 0, laugh: 2 }} />);

		expect(screen.getByText(/5/)).toBeDefined();
		expect(screen.getByText(/2/)).toBeDefined();
		expect(screen.queryByText("👍")).toBeNull();
	});

	it("shows 0 when all counts are 0", () => {
		render(<ReactionDisplay counts={{ heart: 0, thumbs_up: 0 }} />);

		expect(screen.getByText("0")).toBeDefined();
	});

	it("shows 0 when counts are empty", () => {
		render(<ReactionDisplay counts={{}} />);

		expect(screen.getByText("0")).toBeDefined();
	});
});
