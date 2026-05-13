// SPDX-License-Identifier: AGPL-3.0-or-later

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface AdaptiveVideoPlayerProps {
	videoUid: string;
	thumbnailUrl: string;
	canAutoplay: boolean;
}

export function AdaptiveVideoPlayer({
	videoUid,
	thumbnailUrl,
	canAutoplay,
}: AdaptiveVideoPlayerProps) {
	const [isIntersecting, setIsIntersecting] = useState(false);
	const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	// Intersection Observer dla viewport detection
	useEffect(() => {
		if (!canAutoplay || !containerRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				setIsIntersecting(entries[0]?.isIntersecting ?? false);
			},
			{ threshold: 0.5 },
		);

		observer.observe(containerRef.current);

		return () => observer.disconnect();
	}, [canAutoplay]);

	// Autoplay muted gdy w viewport
	const shouldAutoplay = canAutoplay && isIntersecting;

	// Obsługa kliknięcia → fullscreen
	const handleClick = () => {
		if (shouldAutoplay && videoRef.current) {
			// Pause autoplay before opening fullscreen
			videoRef.current.pause();
		}
		setIsFullscreenOpen(true);
	};

	if (isFullscreenOpen) {
		return <FullscreenPlayer videoUid={videoUid} onClose={() => setIsFullscreenOpen(false)} />;
	}

	return (
		<div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-md">
			{shouldAutoplay ? (
				<video
					ref={videoRef}
					src={`/api/app/videos/${videoUid}/stream`}
					className="w-full object-cover"
					muted
					autoPlay
					playsInline
					loop
					onClick={handleClick}
				/>
			) : (
				<button
					type="button"
					onClick={handleClick}
					className="relative block w-full"
					aria-label="Odtwórz wideo"
				>
					<img
						src={thumbnailUrl}
						alt="Miniatura wideo"
						className="aspect-video w-full rounded-md object-cover transition-transform hover:scale-105"
					/>
					<div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/10">
						<div className="flex size-16 items-center justify-center rounded-full bg-white/90 drop-shadow-lg">
							<svg
								className="h-8 w-8 text-foreground pl-1"
								fill="currentColor"
								viewBox="0 0 24 24"
								role="img"
								aria-label="Odtwórz wideo"
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						</div>
					</div>
				</button>
			)}
		</div>
	);
}

interface FullscreenPlayerProps {
	videoUid: string;
	onClose: () => void;
}

function FullscreenPlayer({ videoUid, onClose }: FullscreenPlayerProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
			<div className="relative h-full w-full max-w-7xl">
				<iframe
					src={`https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_ID}.cloudflarestream.com/${videoUid}/iframe`}
					className="h-full w-full"
					allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					title="Odtwarzacz wideo"
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="absolute right-4 top-4 bg-black/50 text-white hover:bg-black/70"
					aria-label="Zamknij pełny ekran"
				>
					<X className="h-6 w-6" />
				</Button>
			</div>
		</div>
	);
}
