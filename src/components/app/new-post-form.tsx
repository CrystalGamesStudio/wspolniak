// SPDX-License-Identifier: AGPL-3.0-or-later
import { ImagePlus, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface NewPostFormProps {
	onSubmit: (data: { description: string; files: File[] }) => void;
	isSubmitting: boolean;
}

export function NewPostForm({ onSubmit, isSubmitting }: NewPostFormProps) {
	const [description, setDescription] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [previews, setPreviews] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		const selected = Array.from(e.target.files ?? []);
		setError(null);

		if (selected.length > MAX_FILES) {
			setError(`Maksymalnie ${MAX_FILES} zdjęć na post`);
			return;
		}

		const oversized = selected.find((f) => f.size > MAX_FILE_SIZE_BYTES);
		if (oversized) {
			setError(`Plik "${oversized.name}" przekracza ${MAX_FILE_SIZE_MB} MB`);
			return;
		}

		setFiles(selected);

		const urls = selected.map((f) => URL.createObjectURL(f));
		setPreviews((prev) => {
			for (const url of prev) URL.revokeObjectURL(url);
			return urls;
		});
	}, []);

	const removeFile = useCallback((index: number) => {
		setFiles((prev) => {
			const newFiles = prev.filter((_, i) => i !== index);
			if (newFiles.length === 0) {
				fileInputRef.current!.value = "";
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

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			if (files.length === 0 && !description.trim()) {
				setError("Dodaj tekst lub zdjęcie");
				return;
			}
			onSubmit({ description, files });
		},
		[description, files, onSubmit],
	);

	const canSubmit = useMemo(
		() => (files.length > 0 || description.trim().length > 0) && !isSubmitting,
		[files.length, description, isSubmitting],
	);

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
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="photos">Zdjęcia</Label>
				<input
					id="photos"
					ref={fileInputRef}
					type="file"
					accept={ACCEPTED_TYPES}
					multiple
					onChange={handleFileChange}
					className="hidden"
				/>
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => fileInputRef.current?.click()}
				>
					<ImagePlus className="mr-2 h-4 w-4" />
					{files.length > 0
						? `Wybrano ${files.length} ${files.length === 1 ? "zdjęcie" : files.length < 5 ? "zdjęcia" : "zdjęć"}`
						: "Wybierz zdjęcia"}
				</Button>
			</div>

			{previews.length > 0 && (
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
					{previews.map((url, i) => (
						<div key={url} className="relative aspect-square">
							<img
								src={url}
								alt={`Podgląd ${i + 1}`}
								className="aspect-square w-full rounded-md object-cover"
							/>
							<button
								type="button"
								onClick={() => removeFile(i)}
								className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-90 transition-opacity hover:opacity-100"
								title="Usuń zdjęcie"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}

			<Button type="submit" className="w-full" disabled={!canSubmit}>
				{isSubmitting ? "Publikowanie..." : "Opublikuj"}
			</Button>
		</form>
	);
}
