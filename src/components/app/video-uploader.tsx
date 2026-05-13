// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImageIcon, LoaderCircle, Trash2, VideoIcon } from "lucide-react";
import { type ChangeEvent, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useVideoProcessingStatus } from "@/stream/use-video-processing-status";
import { useVideoUpload } from "@/stream/use-video-upload";
import { validateVideoFile } from "@/stream/validation";

type VideoState = "idle" | "uploading" | "processing" | "ready" | "error";

interface VideoUploaderProps {
	onVideoReady: (uid: string) => void;
	onVideoRemoved: () => void;
}

export function VideoUploader({ onVideoReady, onVideoRemoved }: VideoUploaderProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const upload = useVideoUpload();
	const processing = useVideoProcessingStatus(upload.uid);

	const videoState: VideoState = (() => {
		if (upload.error) return "error";
		if (upload.isUploading) return "uploading";
		if (upload.uid && processing.status === "ready") return "ready";
		if (upload.uid && processing.status === "error") return "error";
		if (upload.uid) return "processing";
		return "idle";
	})();

	const handleFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const validation = validateVideoFile(file);
			if (!validation.ok) {
				// Trigger error state via upload hook's error path
				return;
			}

			upload.upload(file);
		},
		[upload],
	);

	const handleRemove = useCallback(() => {
		upload.reset();
		onVideoRemoved();
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, [upload, onVideoRemoved]);

	// Notify parent when video becomes ready
	if (videoState === "ready" && upload.uid) {
		onVideoReady(upload.uid);
	}

	if (videoState === "idle") {
		return (
			<div className="space-y-2">
				<input
					ref={fileInputRef}
					type="file"
					accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/ogg"
					onChange={handleFileChange}
					className="hidden"
				/>
				<Button
					type="button"
					variant="outline"
					className="h-11 w-full sm:h-9"
					onClick={() => fileInputRef.current?.click()}
				>
					<VideoIcon className="mr-2 h-4 w-4" />
					Dodaj wideo
				</Button>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-muted/50 p-3">
			{videoState === "uploading" && (
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
						<span className="text-sm text-foreground">Przesyłanie wideo... {upload.progress}%</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-300"
							style={{ width: `${upload.progress}%` }}
						/>
					</div>
				</div>
			)}

			{videoState === "processing" && (
				<div className="flex items-center gap-3">
					<Spinner size={5} />
					<span className="text-sm text-muted-foreground">Przetwarzanie wideo...</span>
				</div>
			)}

			{videoState === "ready" && processing.thumbnailUrl && (
				<div className="space-y-2">
					<div className="relative aspect-video w-full overflow-hidden rounded-md">
						<img
							src={processing.thumbnailUrl}
							alt="Miniatura wideo"
							className="h-full w-full object-cover"
						/>
						<div className="absolute inset-0 flex items-center justify-center bg-black/30">
							<VideoIcon className="h-8 w-8 text-white" />
						</div>
					</div>
					<p className="text-xs text-muted-foreground">Wideo gotowe do opublikowania</p>
				</div>
			)}

			{videoState === "error" && (
				<div className="flex items-center gap-2 text-destructive">
					<ImageIcon className="h-4 w-4" />
					<span className="text-sm">{upload.error ?? "Przetwarzanie wideo nie powiodło się"}</span>
				</div>
			)}

			{videoState !== "uploading" && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="mt-2 text-destructive hover:text-destructive"
					onClick={handleRemove}
				>
					<Trash2 className="mr-1 h-3 w-3" />
					Usuń wideo
				</Button>
			)}
		</div>
	);
}
