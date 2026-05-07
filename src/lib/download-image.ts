// SPDX-License-Identifier: AGPL-3.0-or-later

export async function downloadImage(url: string, filename: string): Promise<void> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			window.open(url, "_blank");
			return;
		}
		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = blobUrl;
		link.download = filename;
		link.style.display = "none";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(blobUrl);
	} catch {
		window.open(url, "_blank");
	}
}
