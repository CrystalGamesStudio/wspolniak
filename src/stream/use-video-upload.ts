// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useRef, useState } from "react";

interface VideoUploadState {
	progress: number;
	uid: string | null;
	error: string | null;
	isUploading: boolean;
}

interface VideoUploadActions {
	upload: (file: File) => void;
	reset: () => void;
}

export function useVideoUpload(): VideoUploadState & VideoUploadActions {
	const [state, setState] = useState<VideoUploadState>({
		progress: 0,
		uid: null,
		error: null,
		isUploading: false,
	});

	const xhrRef = useRef<XMLHttpRequest | null>(null);

	const upload = useCallback((file: File) => {
		setState({ progress: 0, uid: null, error: null, isUploading: true });

		const xhr = new XMLHttpRequest();
		xhrRef.current = xhr;

		fetch("/api/app/videos/upload-url", { method: "POST", credentials: "include" })
			.then((res) => {
				if (!res.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
				return res.json() as Promise<{ data: { uid: string; uploadURL: string } }>;
			})
			.then(({ data }) => {
				const { uid, uploadURL } = data;

				xhr.upload.addEventListener("progress", (e) => {
					if (e.lengthComputable) {
						const pct = Math.round((e.loaded / e.total) * 100);
						setState((prev) => ({ ...prev, progress: pct }));
					}
				});

				xhr.addEventListener("load", () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						setState({ progress: 100, uid, error: null, isUploading: false });
					} else {
						setState({
							progress: 0,
							uid: null,
							error: "Upload nie powiódł się",
							isUploading: false,
						});
					}
				});

				xhr.addEventListener("error", () => {
					setState({ progress: 0, uid: null, error: "Upload nie powiódł się", isUploading: false });
				});

				const formData = new FormData();
				formData.append("file", file);

				xhr.open("POST", uploadURL);
				xhr.send(formData);
			})
			.catch((err: Error) => {
				setState({ progress: 0, uid: null, error: err.message, isUploading: false });
			});
	}, []);

	const reset = useCallback(() => {
		xhrRef.current?.abort();
		xhrRef.current = null;
		setState({ progress: 0, uid: null, error: null, isUploading: false });
	}, []);

	return { ...state, upload, reset };
}
