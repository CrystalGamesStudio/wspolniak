// SPDX-License-Identifier: AGPL-3.0-or-later
import { compressImage } from "./compress";

function setupMocks(opts: { naturalWidth: number; naturalHeight: number; blob?: Blob }) {
	const ctx = { drawImage: vi.fn() };
	const toBlob = vi.fn((cb: (b: Blob) => void) => {
		const blob = opts.blob ?? new Blob(["compressed"], { type: "image/webp" });
		cb(blob);
	});

	const mockCanvas = {
		width: 0,
		height: 0,
		getContext: vi.fn(() => ctx),
		toBlob,
	};

	const origCreateElement = document.createElement.bind(document);
	vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
		if (tag === "canvas") return mockCanvas as unknown as HTMLElement;
		return origCreateElement(tag);
	});

	vi.stubGlobal(
		"Image",
		class MockImage {
			naturalWidth = opts.naturalWidth;
			naturalHeight = opts.naturalHeight;
			onload: (() => void) | null = null;
			onerror: ((e: Error) => void) | null = null;
			_src = "";
			get src() {
				return this._src;
			}
			set src(v: string) {
				this._src = v;
				if (this.onload) this.onload();
			}
		},
	);

	vi.stubGlobal("URL", {
		createObjectURL: vi.fn(() => "blob:mock"),
		revokeObjectURL: vi.fn(),
	});

	return { mockCanvas, ctx, toBlob };
}

describe("compressImage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resizes image wider than maxWidth proportionally", async () => {
		const { mockCanvas } = setupMocks({
			naturalWidth: 2400,
			naturalHeight: 1600,
		});

		await compressImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }), {
			maxWidth: 1200,
		});

		expect(mockCanvas.width).toBe(1200);
		expect(mockCanvas.height).toBe(800);
	});

	it("does not upscale image smaller than maxWidth", async () => {
		const { mockCanvas } = setupMocks({
			naturalWidth: 800,
			naturalHeight: 600,
		});

		await compressImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }));

		expect(mockCanvas.width).toBe(800);
		expect(mockCanvas.height).toBe(600);
	});

	it("exports canvas as WebP with configured quality", async () => {
		const { toBlob } = setupMocks({
			naturalWidth: 800,
			naturalHeight: 600,
		});

		await compressImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }), {
			maxWidth: 1200,
			quality: 0.8,
		});

		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.8);
	});

	it("returns File with webp extension and type", async () => {
		setupMocks({
			naturalWidth: 800,
			naturalHeight: 600,
		});

		const result = await compressImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }));

		expect(result.name).toBe("photo.webp");
		expect(result.type).toBe("image/webp");
	});

	it("replaces original extension with webp", async () => {
		setupMocks({
			naturalWidth: 800,
			naturalHeight: 600,
		});

		const result = await compressImage(new File(["data"], "IMG_1234.HEIC", { type: "image/heic" }));

		expect(result.name).toBe("IMG_1234.webp");
	});

	it("cleans up object URL after processing", async () => {
		setupMocks({
			naturalWidth: 800,
			naturalHeight: 600,
		});

		await compressImage(new File(["data"], "photo.jpg", { type: "image/jpeg" }));

		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
	});
});
