// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useRef, useState } from "react";

type ProcessingStatus = "idle" | "processing" | "ready" | "error";

interface VideoProcessingState {
	status: ProcessingStatus;
	thumbnailUrl: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useVideoProcessingStatus(uid: string | null): VideoProcessingState {
	const [status, setStatus] = useState<ProcessingStatus>("idle");
	const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const poll = useCallback(async () => {
		if (!uid) return;

		try {
			const res = await fetch(`/api/app/videos/${uid}/status`, { credentials: "include" });
			if (!res.ok) return;

			const body = (await res.json()) as {
				data: { status: "processing" | "ready" | "error"; thumbnailUrl: string };
			};

			setStatus(body.data.status);
			setThumbnailUrl(body.data.thumbnailUrl);

			if (body.data.status === "ready" || body.data.status === "error") {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			}
		} catch {
			// Network error — keep polling, don't change status
		}
	}, [uid]);

	useEffect(() => {
		if (!uid) {
			setStatus("idle");
			setThumbnailUrl(null);
			return;
		}

		setStatus("processing");

		// Initial fetch
		poll();

		intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [uid, poll]);

	return { status, thumbnailUrl };
}
