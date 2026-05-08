// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ImageLightbox } from "./image-lightbox";

const images = [
	{ id: "img-1", src: "https://example.com/1.jpg", alt: "Zdjęcie 1" },
	{ id: "img-2", src: "https://example.com/2.jpg", alt: "Zdjęcie 2" },
	{ id: "img-3", src: "https://example.com/3.jpg", alt: "Zdjęcie 3" },
];

function touchStart(target: Element, x: number, y: number) {
	fireEvent.touchStart(target, {
		touches: [{ clientX: x, clientY: y }],
	});
}

function touchEnd(target: Element, x: number, y: number) {
	fireEvent.touchEnd(target, {
		changedTouches: [{ clientX: x, clientY: y }],
	});
}

describe("ImageLightbox", () => {
	it("renders nothing when closed", () => {
		render(<ImageLightbox images={images} open={false} onClose={() => {}} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders overlay with the initial image when open", () => {
		render(<ImageLightbox images={images} open={true} onClose={() => {}} />);

		const dialog = screen.getByRole("dialog");
		expect(dialog).toBeDefined();

		const img = screen.getByRole("img");
		expect(img).toBeDefined();
		expect(img.getAttribute("src")).toBe("https://example.com/1.jpg");
	});

	it("renders image at specified initialIndex", () => {
		render(<ImageLightbox images={images} initialIndex={2} open={true} onClose={() => {}} />);

		const img = screen.getByRole("img");
		expect(img.getAttribute("src")).toBe("https://example.com/3.jpg");
	});

	it("navigates to next image via next button", async () => {
		const user = userEvent.setup();
		render(<ImageLightbox images={images} open={true} onClose={() => {}} />);

		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");

		await user.click(screen.getByLabelText("Następne zdjęcie"));

		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/2.jpg");
	});

	it("navigates to previous image via prev button", async () => {
		const user = userEvent.setup();
		render(<ImageLightbox images={images} initialIndex={1} open={true} onClose={() => {}} />);

		await user.click(screen.getByLabelText("Poprzednie zdjęcie"));

		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
	});

	it("wraps around when navigating past the last image", async () => {
		const user = userEvent.setup();
		render(<ImageLightbox images={images} initialIndex={2} open={true} onClose={() => {}} />);

		await user.click(screen.getByLabelText("Następne zdjęcie"));

		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
	});

	it("wraps around when navigating before the first image", async () => {
		const user = userEvent.setup();
		render(<ImageLightbox images={images} initialIndex={0} open={true} onClose={() => {}} />);

		await user.click(screen.getByLabelText("Poprzednie zdjęcie"));

		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/3.jpg");
	});

	it("closes on Escape key", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<ImageLightbox images={images} open={true} onClose={onClose} />);

		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	it("closes on backdrop click", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<ImageLightbox images={images} open={true} onClose={onClose} />);

		await user.click(screen.getByRole("dialog"));

		await waitFor(() => {
			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	it("does not close when clicking the image itself", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<ImageLightbox images={images} open={true} onClose={onClose} />);

		await user.click(screen.getByRole("img"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("navigates with ArrowRight and ArrowLeft keys", async () => {
		const user = userEvent.setup();
		render(<ImageLightbox images={images} open={true} onClose={() => {}} />);

		await user.keyboard("{ArrowRight}");
		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/2.jpg");

		await user.keyboard("{ArrowLeft}");
		expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
	});

	describe("swipe navigation", () => {
		it("navigates to next image on swipe left", () => {
			render(<ImageLightbox images={images} open={true} onClose={() => {}} />);
			const dialog = screen.getByRole("dialog");

			touchStart(dialog, 200, 100);
			touchEnd(dialog, 100, 100);

			expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/2.jpg");
		});

		it("navigates to previous image on swipe right", () => {
			render(<ImageLightbox images={images} initialIndex={1} open={true} onClose={() => {}} />);
			const dialog = screen.getByRole("dialog");

			touchStart(dialog, 100, 100);
			touchEnd(dialog, 200, 100);

			expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
		});

		it("ignores short swipes below threshold", () => {
			render(<ImageLightbox images={images} open={true} onClose={() => {}} />);
			const dialog = screen.getByRole("dialog");

			touchStart(dialog, 200, 100);
			touchEnd(dialog, 170, 100);

			expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
		});

		it("ignores vertical swipes", () => {
			render(<ImageLightbox images={images} open={true} onClose={() => {}} />);
			const dialog = screen.getByRole("dialog");

			touchStart(dialog, 100, 100);
			touchEnd(dialog, 100, 300);

			expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/1.jpg");
		});
	});
});
