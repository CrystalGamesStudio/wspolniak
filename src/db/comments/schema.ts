// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { mentionSchema } from "@/db/mentions/schema";

export { type Mention, mentionSchema } from "@/db/mentions/schema";

export const createCommentSchema = z.object({
	body: z
		.string()
		.min(1, "Komentarz nie może być pusty")
		.max(1000, "Komentarz może mieć maksymalnie 1000 znaków"),
	mentions: z.array(mentionSchema).max(20, "Zbyt wiele wspomnień").default([]),
});

export type CreateCommentRequest = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
	body: z
		.string()
		.min(1, "Komentarz nie może być pusty")
		.max(1000, "Komentarz może mieć maksymalnie 1000 znaków"),
});

export type UpdateCommentRequest = z.infer<typeof updateCommentSchema>;

export const createReplySchema = z.object({
	body: z
		.string()
		.min(1, "Odpowiedź nie może być pusta")
		.max(1000, "Odpowiedź może mieć maksymalnie 1000 znaków"),
	mentions: z.array(mentionSchema).max(20, "Zbyt wiele wspomnień").default([]),
});

export type CreateReplyRequest = z.infer<typeof createReplySchema>;
