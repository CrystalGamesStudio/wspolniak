// SPDX-License-Identifier: AGPL-3.0-or-later
import { MAX_VIDEO_SIZE_BYTES, SUPPORTED_VIDEO_TYPES, validateVideoFile } from "./validation";

describe("validateVideoFile", () => {
	it("accepts a valid MP4 file under the size limit", () => {
		const result = validateVideoFile({ size: 50 * 1024 * 1024, type: "video/mp4" });
		expect(result.ok).toBe(true);
	});

	it("accepts all supported video formats", () => {
		for (const type of SUPPORTED_VIDEO_TYPES) {
			const result = validateVideoFile({ size: 1024, type });
			expect(result.ok).toBe(true);
		}
	});

	it("rejects a file exceeding 100 MB", () => {
		const result = validateVideoFile({ size: MAX_VIDEO_SIZE_BYTES + 1, type: "video/mp4" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/100\s*MB/i);
		}
	});

	it("rejects exactly 100 MB plus one byte", () => {
		const result = validateVideoFile({ size: 100 * 1024 * 1024 + 1, type: "video/mp4" });
		expect(result.ok).toBe(false);
	});

	it("accepts exactly 100 MB", () => {
		const result = validateVideoFile({ size: 100 * 1024 * 1024, type: "video/mp4" });
		expect(result.ok).toBe(true);
	});

	it("rejects unsupported format", () => {
		const result = validateVideoFile({ size: 1024, type: "video/avi" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/format/i);
		}
	});

	it("rejects empty type", () => {
		const result = validateVideoFile({ size: 1024, type: "" });
		expect(result.ok).toBe(false);
	});
});
