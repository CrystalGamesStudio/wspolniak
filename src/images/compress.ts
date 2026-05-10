// SPDX-License-Identifier: AGPL-3.0-or-later

export type CompressOptions = {
	maxWidth?: number;
	quality?: number;
};

export async function compressImage(file: File, options?: CompressOptions): Promise<File> {
	const { maxWidth = 1200, quality = 0.7 } = options ?? {};

	const url = URL.createObjectURL(file);

	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
		img.src = url;
	});

	let width = img.naturalWidth;
	let height = img.naturalHeight;

	if (width > maxWidth) {
		height = Math.round(height * (maxWidth / width));
		width = maxWidth;
	}

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	ctx?.drawImage(img, 0, 0, width, height);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(b) => {
				if (b) resolve(b);
				else reject(new Error("Image conversion failed"));
			},
			"image/webp",
			quality,
		);
	});

	URL.revokeObjectURL(url);

	const name = file.name.replace(/\.[^.]+$/, ".webp");
	return new File([blob], name, { type: "image/webp" });
}
