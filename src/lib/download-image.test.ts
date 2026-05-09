// SPDX-License-Identifier: AGPL-3.0-or-later
import { downloadImage } from "@/lib/download-image";

function mockFetchSuccess() {
	const mockBlob = new Blob(["fake-image-data"], { type: "image/jpeg" });
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			blob: () => Promise.resolve(mockBlob),
			headers: { get: () => null },
			body: null,
		}),
	);
}

function mockFetchFailure() {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
}

function mockCreateObjectURL() {
	const url = "blob:http://localhost/fake";
	vi.stubGlobal("URL", {
		...URL,
		createObjectURL: vi.fn().mockReturnValue(url),
		revokeObjectURL: vi.fn(),
	});
	return url;
}

function mockAnchorElement() {
	const clickSpy = vi.fn();
	const anchor = { click: clickSpy, href: "", download: "", style: {} };
	const createElementSpy = vi.fn().mockReturnValue(anchor);
	const appendChildSpy = vi.fn();
	const removeChildSpy = vi.fn();

	vi.stubGlobal("document", {
		...document,
		createElement: createElementSpy,
		body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
	});

	return { clickSpy, anchor, createElementSpy, appendChildSpy, removeChildSpy };
}

describe("downloadImage", () => {
	afterEach(() => vi.restoreAllMocks());

	it("fetches image and triggers download", async () => {
		mockFetchSuccess();
		const blobUrl = mockCreateObjectURL();
		const { clickSpy } = mockAnchorElement();

		await downloadImage("https://example.com/image.jpg", "photo.jpg");

		expect(fetch).toHaveBeenCalledWith("https://example.com/image.jpg");
		expect(clickSpy).toHaveBeenCalled();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
	});

	it("opens image in new tab on download failure", async () => {
		mockFetchFailure();
		const openSpy = vi.fn();
		vi.stubGlobal("window", { ...window, open: openSpy });

		await downloadImage("https://example.com/image.jpg", "photo.jpg");

		expect(openSpy).toHaveBeenCalledWith("https://example.com/image.jpg", "_blank");
	});
});
