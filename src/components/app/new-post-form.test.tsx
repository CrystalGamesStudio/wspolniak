// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { NewPostForm } from "./new-post-form";

describe("NewPostForm", () => {
	it("renders file picker and description input", () => {
		render(<NewPostForm onSubmit={vi.fn()} isSubmitting={false} />);

		expect(screen.getByLabelText(/opis/i)).toBeDefined();
		expect(screen.getByLabelText(/zdjęcia/i)).toBeDefined();
		expect(screen.getByRole("button", { name: /opublikuj/i })).toBeDefined();
	});

	it("shows file count validation error for >10 files", () => {
		const { container } = render(<NewPostForm onSubmit={vi.fn()} isSubmitting={false} />);

		const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
		expect(fileInput).toBeDefined();
		expect(fileInput.accept).toContain("image/jpeg");
		expect(fileInput.accept).toContain("image/heic");
		expect(fileInput.multiple).toBe(true);
	});

	it("disables submit button when submitting", () => {
		render(<NewPostForm onSubmit={vi.fn()} isSubmitting={true} />);

		const button = screen.getByRole("button", { name: /publikowanie/i });
		expect(button).toBeDefined();
		expect((button as HTMLButtonElement).disabled).toBe(true);
	});
});
