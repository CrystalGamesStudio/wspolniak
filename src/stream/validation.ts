// SPDX-License-Identifier: AGPL-3.0-or-later

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export const SUPPORTED_VIDEO_TYPES = [
	"video/mp4",
	"video/webm",
	"video/quicktime",
	"video/x-msvideo",
	"video/x-matroska",
	"video/ogg",
] as const;

const SUPPORTED_SET = new Set<string>(SUPPORTED_VIDEO_TYPES);

interface VideoFileInput {
	size: number;
	type: string;
}

type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateVideoFile(input: VideoFileInput): ValidationResult {
	if (!input.type || !SUPPORTED_SET.has(input.type)) {
		return {
			ok: false,
			error: "Nieobsługiwany format wideo. Obsługiwane formaty: MP4, WebM, MOV, AVI, MKV, OGG.",
		};
	}

	if (input.size > MAX_VIDEO_SIZE_BYTES) {
		return { ok: false, error: "Plik wideo jest za duży. Maksymalny rozmiar to 100 MB." };
	}

	return { ok: true };
}
