// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const wheelAccumRef = useRef(0);

	const goNext = useCallback(() => {
		setCurrentIndex((i) => (i + 1) % images.length);
	}, [images.length]);

	const goPrev = useCallback(() => {
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
			if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
			wheelAccumRef.current += e.deltaX;
			if (Math.abs(wheelAccumRef.current) < SWIPE_THRESHOLD) return;
			wheelAccumRef.current = 0;
			if (e.deltaX > 0) goNext();
			else goPrev();
		},
		[goNext, goPrev],
	);

	useEffect(() => {
		if (!open) return;
		setVisible(true);
		setAnimatingOut(false);
		setCurrentIndex(initialIndex);
		wheelAccumRef.current = 0;
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("wheel", handleWheel, { passive: true });
		return () => {
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
		>
			<div className="relative max-h-screen max-w-screen-lg p-4">
				<img
					src={image.src}
					alt={image.alt}
					className="max-h-[85vh] max-w-full rounded-lg object-contain"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				/>
			</div>

			<div className="fixed right-2 top-2 flex gap-2 p-2 sm:right-4 sm:top-4">
				<a
					href={image.src}
					download
					onClick={(e) => e.stopPropagation()}
					className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:px-3 sm:py-2"
					aria-label="Pobierz zdjęcie"
				>
					<Download className="h-8 w-8 sm:h-5 sm:w-5" />
					<span className="text-base font-medium sm:text-sm">Pobierz</span>
				</a>
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
