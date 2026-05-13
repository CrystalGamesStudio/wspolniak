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
import { ImagePlus, VideoIcon, X } from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoaderIcon } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reorder } from "@/lib/reorder";
import { uploadVideo } from "@/stream/upload-video";
import { validateVideoFile } from "@/stream/validation";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const ACCEPTED_VIDEO_TYPES =
	"video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/ogg";
const MAX_IMAGES = 10;
const MAX_VIDEOS = 3;
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface NewPostFormProps {
	onSubmit: (data: { description: string; files: File[]; cfStreamUids: string[] }) => void;
	isSubmitting: boolean;
}

type MediaType = "image" | "video";

interface MediaItem {
	id: string;
	type: MediaType;
	// Image fields
	file?: File;
	preview?: string;
	// Video fields
	videoUid?: string | null;
	videoProgress?: number;
	videoError?: string | null;
	cleanup?: () => void;
}

function SortablePreview({
	id,
	url,
	type,
	index,
	isOver,
	onRemove,
	isVideo,
	videoProgress,
}: {
	id: string;
	url: string;
	type: MediaType;
	index: number;
	isOver: boolean;
	onRemove: () => void;
	isVideo?: boolean;
	videoProgress?: number;
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
			className={`relative touch-none ${isDragging ? "scale-90 opacity-80" : ""} ${isOver ? "ring-4 ring-green-500 ring-offset-2 rounded-md" : ""} ${type === "video" ? "aspect-video" : "aspect-square"}`}
		>
			{isVideo && videoProgress !== undefined && videoProgress < 100 ? (
				<div className="aspect-video w-full rounded-md bg-muted flex items-center justify-center">
					<div className="text-center">
						<LoaderIcon loading />
						<p className="text-sm text-muted-foreground mt-2">{videoProgress}%</p>
					</div>
				</div>
			) : (
				<img src={url} alt={`Podgląd ${index + 1}`} className="w-full rounded-md object-cover" />
			)}
			{type === "video" && videoProgress === 100 && (
				<div className="absolute inset-0 flex items-center justify-center">
					<VideoIcon className="h-8 w-8 text-white drop-shadow-lg" />
				</div>
			)}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				onPointerDown={(e) => e.stopPropagation()}
				className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100"
				title="Usuń"
			>
				<X className="h-3 w-3" />
			</button>
		</div>
	);
}

export function NewPostForm({ onSubmit, isSubmitting }: NewPostFormProps) {
	const [description, setDescription] = useState("");
	const [media, setMedia] = useState<MediaItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const videoInputRef = useRef<HTMLInputElement>(null);
	const videoPollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

	// Clean up video polling on unmount
	useEffect(() => {
		return () => {
			for (const interval of videoPollIntervalsRef.current.values()) {
				clearInterval(interval);
			}
		};
	}, []);

	const images = useMemo(() => media.filter((m) => m.type === "image"), [media]);
	const videos = useMemo(() => media.filter((m) => m.type === "video"), [media]);

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	const sortableIds = useMemo(() => media.map((m) => m.id), [media]);

	const handleDragStart = useCallback((_event: DragStartEvent) => {
		setOverId(null);
	}, []);

	const handleDragOver = useCallback((event: DragOverEvent) => {
		setOverId(event.over ? String(event.over.id) : null);
	}, []);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setOverId(null);
			const { active, over } = event;
			if (!over || active.id === over.id) return;

			const activeIndex = media.findIndex((m) => m.id === active.id);
			const overIndex = media.findIndex((m) => m.id === over.id);

			setMedia((prev) => reorder(prev, activeIndex, overIndex));
		},
		[media],
	);

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

			if (images.length + incoming.length > MAX_IMAGES) {
				setError(`Maksymalnie ${MAX_IMAGES} zdjęć na post`);
				return;
			}

			const newItems: MediaItem[] = incoming.map((file, i) => {
				const preview = URL.createObjectURL(file);
				return {
					id: `img-${Date.now()}-${i}`,
					type: "image" as const,
					file,
					preview,
				};
			});

			setMedia((prev) => [...prev, ...newItems]);

			if (imageInputRef.current) imageInputRef.current.value = "";
		},
		[images.length],
	);

	const handleVideoFileChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			setError(null);

			if (videos.length >= MAX_VIDEOS) {
				setError(`Maksymalnie ${MAX_VIDEOS} wideo na post`);
				return;
			}

			const validation = validateVideoFile(file);
			if (!validation.ok) {
				setError(validation.error);
				return;
			}

			const id = `video-${Date.now()}`;
			const newItem: MediaItem = {
				id,
				type: "video",
				videoUid: null,
				videoProgress: 0,
				videoError: null,
			};

			setMedia((prev) => [...prev, newItem]);

			// Start upload
			const cleanup = uploadVideo(file, {
				onProgress: (progress) => {
					setMedia((prev) =>
						prev.map((m) => (m.id === id ? { ...m, videoProgress: progress } : m)),
					);
				},
				onSuccess: (uid) => {
					setMedia((prev) =>
						prev.map((m) => (m.id === id ? { ...m, videoUid: uid, videoProgress: 100 } : m)),
					);
				},
				onError: (err) => {
					setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, videoError: err } : m)));
				},
			});

			// Store cleanup for this video
			newItem.cleanup = cleanup;

			if (videoInputRef.current) videoInputRef.current.value = "";
		},
		[videos.length],
	);

	const removeMedia = useCallback((id: string) => {
		setMedia((prev) => {
			const item = prev.find((m) => m.id === id);
			if (item?.cleanup) {
				item.cleanup();
			}
			if (item?.preview) {
				URL.revokeObjectURL(item.preview);
			}
			const filtered = prev.filter((m) => m.id !== id);
			if (filtered.length === 0) {
				if (imageInputRef.current) imageInputRef.current.value = "";
				if (videoInputRef.current) videoInputRef.current.value = "";
			}
			return filtered;
		});
	}, []);

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			const readyVideos = videos.filter((v) => v.videoUid);
			if (images.length === 0 && readyVideos.length === 0 && !description.trim()) {
				setError("Dodaj tekst, zdjęcie lub wideo");
				return;
			}
			const videoUids = readyVideos.map((v) => v.videoUid!);
			const files = images.map((i) => i.file!).filter(Boolean);
			onSubmit({
				description,
				files,
				cfStreamUids: videoUids,
			});
		},
		[description, images, videos, onSubmit],
	);

	const canSubmit = useMemo(() => {
		const hasContent = images.length > 0 || description.trim().length > 0;
		const allVideosReady = videos.every((v) => v.videoUid || v.videoError);
		const hasReadyVideos = videos.some((v) => v.videoUid);
		return (hasContent || hasReadyVideos) && !isSubmitting && allVideosReady;
	}, [images.length, description, videos, isSubmitting]);

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
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
				<input
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
					disabled={images.length >= MAX_IMAGES}
					title={images.length > 0 ? `${images.length}/${MAX_IMAGES}` : "Dodaj zdjęcia"}
				>
					<ImagePlus className="h-4 w-4" />
					{images.length > 0 ? (
						<span className="ml-2">
							{images.length}/{MAX_IMAGES}
						</span>
					) : (
						<span className="ml-2">Zdjęcia</span>
					)}
				</Button>

				<input
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
					disabled={videos.length >= MAX_VIDEOS || videos.some((v) => !v.videoUid && !v.videoError)}
					title={
						videos.some((v) => !v.videoUid && !v.videoError)
							? "Upload..."
							: videos.length > 0
								? `${videos.length}/${MAX_VIDEOS}`
								: "Dodaj wideo"
					}
				>
					<VideoIcon className="h-4 w-4" />
					{videos.some((v) => !v.videoUid && !v.videoError) ? (
						<span className="ml-2 text-xs">Upload...</span>
					) : videos.length > 0 ? (
						<span className="ml-2">
							{videos.length}/{MAX_VIDEOS}
						</span>
					) : (
						<span className="ml-2">Wideo</span>
					)}
				</Button>
			</div>

			{/* Media previews */}
			{media.length > 0 && (
				<DndContext
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={sortableIds} strategy={rectSortingStrategy}>
						<div role="listbox" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{media.map((item, index) => {
								const isVideo = item.type === "video";
								const url = isVideo
									? item.videoUid
										? `/api/app/videos/${item.videoUid}/thumbnail`
										: ""
									: (item.preview ?? "");
								const progress = isVideo ? (item.videoProgress ?? 0) : undefined;

								// For videos, poll for thumbnail when ready

								return (
									<SortablePreview
										key={item.id}
										id={item.id}
										url={url}
										type={item.type}
										index={index}
										isOver={overId === item.id}
										onRemove={() => removeMedia(item.id)}
										isVideo={isVideo}
										videoProgress={progress}
									/>
								);
							})}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<Button type="submit" className="h-11 w-full sm:h-9" disabled={!canSubmit}>
				<LoaderIcon loading={isSubmitting} />
				{isSubmitting ? "Publikowanie..." : "Opublikuj"}
			</Button>
		</form>
	);
}
