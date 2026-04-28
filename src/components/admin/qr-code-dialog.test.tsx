// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QrCodeDialog } from "./qr-code-dialog";

describe("QrCodeDialog", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("print button calls window.print", async () => {
		const user = userEvent.setup();
		const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

		render(
			<QrCodeDialog
				open={true}
				onOpenChange={() => {}}
				url="https://example.com/share?code=7843&member=u2"
				memberName="Kasia"
			/>,
		);

		await screen.findAllByRole("img", { name: /Kasia/i });
		const printBtn = screen.getByRole("button", { name: /Drukuj/i });
		await user.click(printBtn);

		expect(printSpy).toHaveBeenCalled();
	});

	it("hides share button when navigator.share is unavailable", async () => {
		// jsdom has no navigator.share by default
		render(
			<QrCodeDialog
				open={true}
				onOpenChange={() => {}}
				url="https://example.com/share?code=7843&member=u2"
				memberName="Kasia"
			/>,
		);

		await screen.findByRole("button", { name: /Pobierz/i });
		expect(screen.queryByRole("button", { name: /Udostępnij/i })).toBeNull();
	});

	it("calls navigator.share when share button clicked", async () => {
		const user = userEvent.setup();
		const shareSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", { value: shareSpy, configurable: true });

		render(
			<QrCodeDialog
				open={true}
				onOpenChange={() => {}}
				url="https://example.com/share?code=7843&member=u2"
				memberName="Kasia"
			/>,
		);

		await screen.findAllByRole("img", { name: /Kasia/i });
		const shareBtn = screen.getByRole("button", { name: /Udostępnij/i });
		await user.click(shareBtn);

		expect(shareSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				url: "https://example.com/share?code=7843&member=u2",
			}),
		);

		Reflect.deleteProperty(navigator, "share");
	});

	it("download button triggers anchor click with member name in filename", async () => {
		const user = userEvent.setup();
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		render(
			<QrCodeDialog
				open={true}
				onOpenChange={() => {}}
				url="https://example.com/share?code=7843&member=u2"
				memberName="Kasia Nowak"
			/>,
		);

		await screen.findAllByRole("img", { name: /Kasia Nowak/i });
		const downloadBtn = screen.getByRole("button", { name: /Pobierz/i });
		await user.click(downloadBtn);

		await waitFor(() => {
			expect(clickSpy).toHaveBeenCalled();
		});
		const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
		expect(anchor.download).toMatch(/kasia-nowak/i);
		expect(anchor.download).toMatch(/\.png$/);
	});

	it("renders an image with the QR data URL when open", async () => {
		render(
			<QrCodeDialog
				open={true}
				onOpenChange={() => {}}
				url="https://example.com/share?code=7843&member=u2"
				memberName="Kasia"
			/>,
		);

		await waitFor(() => {
			const imgs = screen.getAllByRole("img", { name: /Kasia/i }) as HTMLImageElement[];
			const qrImg = imgs.find((img) => img.src.startsWith("data:image/png;base64,"));
			expect(qrImg).toBeDefined();
		});
	});
});
