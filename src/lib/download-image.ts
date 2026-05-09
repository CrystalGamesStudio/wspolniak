// SPDX-License-Identifier: AGPL-3.0-or-later

function isMobileDevice(): boolean {
	return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function downloadImage(
	url: string,
	filename: string,
	onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			window.open(url, "_blank");
			return;
		}

		const contentLength = Number(response.headers.get("content-length") || 0);
		const total = contentLength > 0 ? contentLength : 0;

		if (!response.body || !total) {
			const blob = await response.blob();
			triggerDownload(blob, url, filename);
			return;
		}

		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let loaded = 0;

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			loaded += value.length;
			onProgress?.(loaded, total);
		}

		const blob = new Blob(chunks as BlobPart[], {
			type: response.headers.get("content-type") || "image/jpeg",
		});

		if (isMobileDevice()) {
			const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
			if (navigator.share && navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({ files: [file] });
					return;
				} catch {
					// User cancelled share sheet — fall through to download
				}
			}
		}

		triggerDownload(blob, url, filename);
	} catch {
		window.open(url, "_blank");
	}
}

function triggerDownload(blob: Blob, fallbackUrl: string, filename: string) {
	const blobUrl = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = blobUrl;
	link.download = filename;
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(blobUrl);
	void fallbackUrl;
}
