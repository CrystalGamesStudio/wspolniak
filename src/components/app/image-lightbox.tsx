// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadImage } from "@/lib/download-image";

interface LightboxImage {
	id: string;
	src: string;
	alt: string;
}

interface ImageLightboxProps {
	images: LightboxImage[];
	initialIndex?: number;
	open: boolean;
	onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
	const [visible, setVisible] = useState(false);
	const [animatingOut, setAnimatingOut] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [slideDirection, setSlideDirection] = useState<"right" | "left">("right");
	const [downloading, setDownloading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState(0);
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const wheelAccumRef = useRef(0);

	const goNext = useCallback(() => {
		if (images.length <= 1) return;
		setSlideDirection("right");
		setCurrentIndex((i) => (i + 1) % images.length);
	}, [images.length]);

	const goPrev = useCallback(() => {
		if (images.length <= 1) return;
		setSlideDirection("left");
		setCurrentIndex((i) => (i - 1 + images.length) % images.length);
	}, [images.length]);

	const handleClose = useCallback(() => {
		setAnimatingOut(true);
		setTimeout(() => {
			setVisible(false);
			setAnimatingOut(false);
			onClose();
		}, 150);
	}, [onClose]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
			else if (e.key === "ArrowRight") goNext();
			else if (e.key === "ArrowLeft") goPrev();
		},
		[handleClose, goNext, goPrev],
	);

	const handleWheel = useCallback(
		(e: WheelEvent) => {
			e.preventDefault();
			const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
			wheelAccumRef.current += delta;
			if (Math.abs(wheelAccumRef.current) < SWIPE_THRESHOLD) return;
			wheelAccumRef.current = 0;
			if (delta > 0) goNext();
			else goPrev();
		},
		[goNext, goPrev],
	);

	// Block page scroll and listen for keyboard/wheel
	useEffect(() => {
		if (!open) return;
		setVisible(true);
		setAnimatingOut(false);
		setCurrentIndex(initialIndex);
		wheelAccumRef.current = 0;

		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("wheel", handleWheel);
		};
	}, [open, initialIndex, handleKeyDown, handleWheel]);

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		if (!touch) return;
		touchStartRef.current = { x: touch.clientX, y: touch.clientY };
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		const start = touchStartRef.current;
		if (!start) return;
		touchStartRef.current = null;

		const touch = e.changedTouches[0];
		if (!touch) return;

		const deltaX = touch.clientX - start.x;
		const deltaY = touch.clientY - start.y;

		if (Math.abs(deltaY) > Math.abs(deltaX)) return;
		if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

		if (deltaX < 0) goNext();
		else goPrev();
	};

	if (!visible || images.length === 0) return null;

	const image = images[currentIndex];
	if (!image) return null;

	const isOpen = open && !animatingOut;

	const slideClass =
		slideDirection === "right"
			? "animate-in slide-in-from-right duration-200"
			: "animate-in slide-in-from-left duration-200";

	return (
		<div
			role="dialog"
			aria-modal="true"
			data-state={isOpen ? "open" : "closed"}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 transition-opacity duration-150 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out"
			onClick={handleClose}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") handleClose();
			}}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
			style={{ touchAction: "none" }}
		>
			<div key={currentIndex} className={`relative max-h-screen max-w-screen-lg p-4 ${slideClass}`}>
				<img
					src={image.src}
					alt={image.alt}
					className="max-h-[85vh] max-w-full rounded-lg object-contain"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				/>
			</div>

			<div className="fixed right-2 top-2 flex gap-2 p-2 sm:right-4 sm:top-4">
				<button
					type="button"
					disabled={downloading}
					onClick={(e) => {
						e.stopPropagation();
						setDownloading(true);
						setDownloadProgress(0);
						downloadImage(image.src, `wspolniak-${image.id}.jpg`, (loaded, total) => {
							setDownloadProgress(Math.round((loaded / total) * 100));
						}).finally(() => setDownloading(false));
					}}
					className="relative flex items-center gap-2 overflow-hidden rounded-full bg-white/10 px-4 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:cursor-wait sm:px-3 sm:py-2"
					aria-label="Pobierz zdjęcie"
				>
					{downloading && (
						<div
							className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-200"
							style={{ width: `${downloadProgress}%` }}
						/>
					)}
					{downloading ? (
						<Loader2 className="relative h-8 w-8 animate-spin sm:h-5 sm:w-5" />
					) : (
						<Download className="relative h-8 w-8 sm:h-5 sm:w-5" />
					)}
					<span className="relative text-base font-medium sm:text-sm">
						{downloading ? `${downloadProgress}%` : "Pobierz"}
					</span>
				</button>
				<button
					type="button"
					onClick={handleClose}
					className="rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:p-2"
					aria-label="Zamknij"
				>
					<X className="h-8 w-8 sm:h-6 sm:w-6" />
				</button>
			</div>

			{images.length > 1 && (
				<>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							goPrev();
						}}
						className="fixed left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
						aria-label="Poprzednie zdjęcie"
					>
						<ChevronLeft className="h-6 w-6" />
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							goNext();
						}}
						className="fixed right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
						aria-label="Następne zdjęcie"
					>
						<ChevronRight className="h-6 w-6" />
					</button>
				</>
			)}
		</div>
	);
}
