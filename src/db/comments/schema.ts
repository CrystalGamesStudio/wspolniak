// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const createCommentSchema = z.object({
	body: z
		.string()
		.min(1, "Komentarz nie może być pusty")
		.max(1000, "Komentarz może mieć maksymalnie 1000 znaków"),
});

export type CreateCommentRequest = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
	body: z
		.string()
		.min(1, "Komentarz nie może być pusty")
		.max(1000, "Komentarz może mieć maksymalnie 1000 znaków"),
});

export type UpdateCommentRequest = z.infer<typeof updateCommentSchema>;
