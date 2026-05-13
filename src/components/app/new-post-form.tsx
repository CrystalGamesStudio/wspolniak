// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImagePlus, Trash2, VideoIcon, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoaderIcon } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reorder } from "@/lib/reorder";
import { useVideoProcessingStatus } from "@/stream/use-video-processing-status";
import { useVideoUpload } from "@/stream/use-video-upload";
import { validateVideoFile } from "@/stream/validation";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ACCEPTED_VIDEO_TYPES =
	"video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/ogg";
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface NewPostFormProps {
	onSubmit: (data: { description: string; files: File[]; cfStreamUid?: string }) => void;
	isSubmitting: boolean;
}

function SortablePreview({
	id,
	url,
	index,
	isOver,
	onRemove,
}: {
	id: string;
	url: string;
	index: number;
	isOver: boolean;
	onRemove: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
	});

	const style: React.CSSProperties = isDragging
		? {
				transform: CSS.Transform.toString(transform),
				transition,
				zIndex: 50,
			}
		: {};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			role="option"
			tabIndex={0}
			className={`relative aspect-square touch-none ${isDragging ? "scale-90 opacity-80" : ""} ${isOver ? "ring-4 ring-green-500 ring-offset-2 rounded-md" : ""}`}
		>
			<img
				src={url}
				alt={`Podgląd ${index + 1}`}
				className="aspect-square w-full rounded-md object-cover"
			/>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				onPointerDown={(e) => e.stopPropagation()}
				className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100"
				title="Usuń zdjęcie"
			>
				<X className="h-3 w-3" />
			</button>
		</div>
	);
}

export function NewPostForm({ onSubmit, isSubmitting }: NewPostFormProps) {
	const [description, setDescription] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [previews, setPreviews] = useState<string[]>([]);
	const [videoError, setVideoError] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const videoInputRef = useRef<HTMLInputElement>(null);

	// Video upload hooks
	const videoUpload = useVideoUpload();
	const videoProcessing = useVideoProcessingStatus(videoUpload.uid);

	// Determine video state
	const videoState = useMemo(() => {
		if (videoUpload.error || videoError) return "error";
		if (videoUpload.isUploading) return "uploading";
		if (videoUpload.uid && videoProcessing.status === "ready") return "ready";
		if (videoUpload.uid && videoProcessing.status === "error") return "error";
		if (videoUpload.uid) return "processing";
		return "idle";
	}, [videoUpload, videoProcessing, videoError]);

	// Notify parent when video is ready
	const hasVideo = videoState === "ready" && !!videoUpload.uid;

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const sortableIds = useMemo(() => previews.map((_, i) => `preview-${i}`), [previews]);

	const handleDragStart = useCallback((_event: DragStartEvent) => {
		setOverId(null);
	}, []);

	const handleDragOver = useCallback((event: DragOverEvent) => {
		setOverId(event.over ? String(event.over.id) : null);
	}, []);

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		setOverId(null);
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const activeIndex = Number(String(active.id).replace("preview-", ""));
		const overIndex = Number(String(over.id).replace("preview-", ""));

		setFiles((prev) => reorder(prev, activeIndex, overIndex));
		setPreviews((prev) => reorder(prev, activeIndex, overIndex));
	}, []);

	const handleImageFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const incoming = Array.from(e.target.files ?? []);
			if (incoming.length === 0) return;

			setError(null);

			const oversized = incoming.find((f) => f.size > MAX_FILE_SIZE_BYTES);
			if (oversized) {
				setError(`Plik "${oversized.name}" przekracza ${MAX_FILE_SIZE_MB} MB`);
				return;
			}

			const merged = [...files, ...incoming];
			if (merged.length > MAX_FILES) {
				setError(`Maksymalnie ${MAX_FILES} zdjęć na post`);
				return;
			}

			const urls = incoming.map((f) => URL.createObjectURL(f));
			setFiles(merged);
			setPreviews((prev) => [...prev, ...urls]);

			if (imageInputRef.current) imageInputRef.current.value = "";
		},
		[files],
	);

	const handleVideoFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setVideoError(null);
			setError(null);

			const validation = validateVideoFile(file);
			if (!validation.ok) {
				setVideoError(validation.error);
				return;
			}

			videoUpload.upload(file);
			if (videoInputRef.current) videoInputRef.current.value = "";
		},
		[videoUpload],
	);

	const removeFile = useCallback((index: number) => {
		setFiles((prev) => {
			const newFiles = prev.filter((_, i) => i !== index);
			if (newFiles.length === 0) {
				if (imageInputRef.current) imageInputRef.current.value = "";
			}
			return newFiles;
		});
		setPreviews((prev) => {
			const newPreviews = prev.filter((_, i) => i !== index);
			if (prev[index]) {
				URL.revokeObjectURL(prev[index]);
			}
			return newPreviews;
		});
	}, []);

	const removeVideo = useCallback(() => {
		videoUpload.reset();
		setVideoError(null);
	}, [videoUpload]);

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			if (files.length === 0 && !description.trim() && !hasVideo) {
				setError("Dodaj tekst, zdjęcie lub wideo");
				return;
			}
			onSubmit({
				description,
				files,
				cfStreamUid: hasVideo && videoUpload.uid ? videoUpload.uid : undefined,
			});
		},
		[description, files, hasVideo, onSubmit, videoUpload.uid],
	);

	const canSubmit = useMemo(
		() =>
			(files.length > 0 || description.trim().length > 0 || hasVideo) &&
			!isSubmitting &&
			videoState !== "processing" &&
			videoState !== "uploading",
		[files.length, description, hasVideo, isSubmitting, videoState],
	);

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{(error || videoError) && (
				<Alert variant="destructive">
					<AlertDescription>{error ?? videoError}</AlertDescription>
				</Alert>
			)}

			<div className="space-y-2">
				<Label htmlFor="description">Tekst</Label>
				<Textarea
					id="description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					maxLength={2000}
					rows={24}
					placeholder="Co się wydarzyło?"
					className="min-h-96 resize-y"
					enterKeyHint="enter"
				/>
			</div>

			{/* Media buttons row */}
			<div className="grid grid-cols-2 gap-2 sm:gap-4">
				<div className="space-y-2">
					<Label htmlFor="photos">Zdjęcia</Label>
					<input
						id="photos"
						ref={imageInputRef}
						type="file"
						accept={ACCEPTED_IMAGE_TYPES}
						multiple
						onChange={handleImageFileChange}
						className="hidden"
					/>
					<Button
						type="button"
						variant="outline"
						className="h-11 w-full sm:h-9"
						onClick={() => imageInputRef.current?.click()}
					>
						<ImagePlus className="mr-2 h-4 w-4" />
						{files.length > 0
							? `${files.length} ${files.length === 1 ? "zdjęcie" : files.length < 5 ? "zdjęcia" : "zdjęć"}`
							: "Zdjęcia"}
					</Button>
				</div>

				<div className="space-y-2">
					<Label htmlFor="video">Wideo</Label>
					<input
						id="video"
						ref={videoInputRef}
						type="file"
						accept={ACCEPTED_VIDEO_TYPES}
						onChange={handleVideoFileChange}
						className="hidden"
					/>
					<Button
						type="button"
						variant="outline"
						className="h-11 w-full sm:h-9"
						onClick={() => videoInputRef.current?.click()}
						disabled={videoState === "uploading" || videoState === "processing"}
					>
						<VideoIcon className="mr-2 h-4 w-4" />
						{videoState === "uploading"
							? `${videoUpload.progress}%`
							: videoState === "processing"
								? "Przetwarzanie..."
								: videoState === "ready"
									? "Wideo dodane"
									: "Wideo"}
					</Button>
				</div>
			</div>

			{/* Image previews */}
			{previews.length > 0 && (
				<DndContext
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={sortableIds} strategy={rectSortingStrategy}>
						<div role="listbox" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{previews.map((url, i) => (
								<SortablePreview
									key={sortableIds[i]}
									id={sortableIds[i]}
									url={url}
									index={i}
									isOver={overId === sortableIds[i]}
									onRemove={() => removeFile(i)}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			{/* Video preview */}
			{videoState === "ready" && videoProcessing.thumbnailUrl && (
				<div className="relative aspect-video w-full overflow-hidden rounded-md border border-border">
					<img
						src={videoProcessing.thumbnailUrl}
						alt="Miniatura wideo"
						className="h-full w-full object-cover"
					/>
					<div className="absolute inset-0 flex items-center justify-center bg-black/30">
						<VideoIcon className="h-8 w-8 text-white" />
					</div>
					<button
						type="button"
						onClick={removeVideo}
						className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100"
						title="Usuń wideo"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{videoState === "uploading" && (
				<div className="space-y-2">
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-300"
							style={{ width: `${videoUpload.progress}%` }}
						/>
					</div>
				</div>
			)}

			{videoState === "processing" && (
				<div className="flex items-center gap-2 text-muted-foreground">
					<LoaderIcon loading className="h-4 w-4" />
					<span className="text-sm">Przetwarzanie wideo...</span>
				</div>
			)}

			{(videoState === "error" || videoError) && (
				<div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 p-3">
					<span className="text-sm text-destructive">
						{videoUpload.error ?? videoError ?? "Wideo nie zostało dodane"}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-destructive hover:text-destructive"
						onClick={removeVideo}
					>
						<Trash2 className="mr-1 h-3 w-3" />
						Usuń
					</Button>
				</div>
			)}

			<Button type="submit" className="h-11 w-full sm:h-9" disabled={!canSubmit}>
				<LoaderIcon loading={isSubmitting} />
				{isSubmitting ? "Publikowanie..." : "Opublikuj"}
			</Button>
		</form>
	);
}
