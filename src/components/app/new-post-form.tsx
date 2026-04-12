import { type ChangeEvent, type FormEvent, useCallback, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			if (files.length === 0) {
				setError("Dodaj przynajmniej jedno zdjęcie");
				return;
			}
			onSubmit({ description, files });
		},
		[description, files, onSubmit],
	);

	const canSubmit = useMemo(() => files.length > 0 && !isSubmitting, [files.length, isSubmitting]);

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<div className="space-y-2">
				<Label htmlFor="description">Opis (opcjonalnie)</Label>
				<Input
					id="description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					maxLength={2000}
					placeholder="Co się wydarzyło?"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="photos">Zdjęcia</Label>
				<input
					id="photos"
					type="file"
					accept={ACCEPTED_TYPES}
					multiple
					onChange={handleFileChange}
					className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
				/>
			</div>

			{previews.length > 0 && (
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
					{previews.map((url, i) => (
						<img
							key={url}
							src={url}
							alt={`Podgląd ${i + 1}`}
							className="aspect-square w-full rounded-md object-cover"
						/>
					))}
				</div>
			)}

			<Button type="submit" className="w-full" disabled={!canSubmit}>
				{isSubmitting ? "Publikowanie..." : "Opublikuj"}
			</Button>
		</form>
	);
}
