// SPDX-License-Identifier: AGPL-3.0-or-later
export interface VideoUploadProgress {
	progress: number;
	uid: string | null;
	error: string | null;
	isUploading: boolean;
}

export interface UploadVideoOptions {
	onProgress: (progress: number) => void;
	onSuccess: (uid: string) => void;
	onError: (error: string) => void;
}

let activeXhr: XMLHttpRequest | null = null;

export function uploadVideo(file: File, options: UploadVideoOptions): () => void {
	const { onProgress, onSuccess, onError } = options;

	// Abort any previous upload
	if (activeXhr) {
		activeXhr.abort();
	}

	activeXhr = new XMLHttpRequest();
	const xhr = activeXhr;

	fetch("/api/app/videos/upload-url", { method: "POST", credentials: "include" })
		.then((res) => {
			if (!res.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
			return res.json() as Promise<{ data: { uid: string; uploadURL: string } }>;
		})
		.then(({ data }) => {
			const { uid, uploadURL } = data;

			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) {
					onProgress(Math.round((e.loaded / e.total) * 100));
				}
			});

			xhr.addEventListener("load", () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					onSuccess(uid);
				} else {
					onError("Upload nie powiódł się");
				}
			});

			xhr.addEventListener("error", () => {
				onError("Upload nie powiódł się");
			});

			xhr.addEventListener("abort", () => {
				onError("Upload anulowany");
			});

			const formData = new FormData();
			formData.append("file", file);

			xhr.open("POST", uploadURL);
			xhr.send(formData);
		})
		.catch((err: Error) => {
			onError(err.message);
		});

	// Return cleanup function
	return () => {
		if (xhr) xhr.abort();
	};
}
